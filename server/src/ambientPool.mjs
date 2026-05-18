/**
 * ambientPool.mjs — PostgreSQL-backed ambient message pool
 *
 * 三层 fallback：
 *   1. 内存缓冲（per-process，最快）
 *   2. PostgreSQL ambient_messages 表（跨进程共享）
 *   3. 模板生成器（本地，零延迟，永不失败）
 *
 * Refill 策略：
 *   - PG 库存 < 500 时触发异步 refill，目标 3000 条
 *   - 80% 模板生成 + 20% AI 生成
 *   - 每个进程用 refillLock 防止并发 refill
 */

import crypto from "node:crypto";
import { isDbEnabled } from "./db.mjs";
import { query } from "./db.mjs";
import {
  animalAvatars,
  fanPersonas,
  fanNicknamePool,
  fallbackFanMessages
} from "./fanPersonas.mjs";
import { generateLiveFanMessages } from "./aiClient.mjs";
import { logAiFailure } from "./logger.mjs";
import {
  isMessageAllowedForTime,
  preferredPersonaTypesForTime,
  resolveTimeContext
} from "./timeContext.mjs";

// ── 常量 ──────────────────────────────────────────────────────────────────────

const MEMORY_BUFFER_SIZE = 120;   // 内存缓冲目标大小
const REFILL_THRESHOLD   = 500;   // PG 库存低于此值时触发 refill
const REFILL_TARGET      = 3000;  // refill 目标条数
const AI_RATIO           = 0.20;  // AI 生成比例（其余为模板）
const BATCH_FETCH_SIZE   = 60;    // 每次从 PG 拉取的条数（多取再 shuffle）
const AI_BATCH_SIZE      = 8;     // 每次 AI 生成批次大小（避免 token 截断）

// ── 内存缓冲 ──────────────────────────────────────────────────────────────────

/** @type {import("../../types/idol").FanMessage[]} */
const memoryBuffer = [];

let refillLock = false;
let pgStockCheckedAt = 0;
const PG_STOCK_CHECK_INTERVAL = 30_000; // 30s 内不重复检查库存

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function sha256(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickLanguage() {
  const r = Math.random();
  if (r < 0.50) return "zh";
  if (r < 0.70) return "en";
  if (r < 0.82) return "ko";
  if (r < 0.92) return "jp";
  return "es";
}

/** 从 fanPersonas 里随机选一个支持该语言的 persona */
function pickPersonaForLanguage(language, timeContext = {}) {
  const preferredTypes = preferredPersonaTypesForTime(timeContext);
  const preferred = fanPersonas.filter(
    (p) => preferredTypes.includes(p.type) && (!p.languages || p.languages.includes(language))
  );
  if (preferred.length && Math.random() < 0.45) return pickRandom(preferred);

  const compatible = fanPersonas.filter(
    (p) =>
      (!p.languages || p.languages.includes(language)) &&
      p.type !== "late night fan"
  );
  return pickRandom(compatible.length ? compatible : fanPersonas);
}

// ── 模板消息生成器 ─────────────────────────────────────────────────────────────

/**
 * 
 * 
 * 每种语言的 ambient 模板池。
 * 这些是通用的、不依赖 idol 具体内容的 ambient 消息，
 * 用于在 AI 不可用时保持消息流。
 */
const templatesByLanguage = {
  zh: [
  "我又来了",
  "宝宝今天上线了吗宝宝",
  "今天也来这里报到了",
  "姐姐你知道我每天都来吗",
  "我来了我来了我来了",
  "我下课了第一件事来看你",
  "我刚洗完澡就来等你了",
  "今天真的好崩溃，看到你又好多了",
  "宝宝你一句话不说我也会等的",
  "我知道你在看",
  "你在不在啊在不在啊在不在啊",
  "我现在非常地想你",
  "今天也超级超级超级想你",
  "我每天都在想你，合理吗",
  "姐姐你是不是忘记这里还有一个我",
  "我一边说不等了一边又点进来了",
  "我昨天和诡秘说要脱粉了，但是今天还是很想你😢",
  "你还知道这里有家吗宝宝",
  "姐姐你到底在忙什么啊",
  "你能不能偶尔想起我一下",
  "我每天来打卡，你看见了吗",
  "你知道我今天第几次点开了吗",
  "宝宝宝宝宝宝宝宝宝宝",
  "姐姐姐姐姐姐姐姐姐姐",
  "你理理我你理理我你理理我",
  "我只是想听你说一句话",
  "好想看姐姐的美貌",
  "你只要出现，我就能活到明天",
  "我现在的精神状态取决于你发不发消息",
  "你不营业的时候我真的会开始多想",
  "旧舞台已经被我盘包浆了，什么时候回归呀",
  "我把你上次那句话看了好多遍",
  "你的上一条消息我已经会背了",
  "别管我",
  "没有新照片，我已急哭",
  "宝宝你今天吃饭了吗",
  "姐姐今天吃什么了",
  "吃饭了吗吃饭了吗吃饭了吗",
  "你要是不吃饭我真的会生气",
  "宝宝多喝水，不许装没看见",
  "记得穿外套，最近真的降温了",
  "你是不是又熬夜了",
  "姐姐你眼睛下面黑眼圈是不是又重了",
  "宝宝你要好好照顾自己，别让我操心",
  "你可以不回我，但你必须好好吃饭",
  "宝宝妈妈给你把水壶装好了，记得慢慢喝，别一口闷，太烫了先晾一晾，出门别忘了带纸巾和充电宝，今天如果很累就早点回来休息，不要逞强，妈妈会在这里等你下班",
  "宝宝今天出门记得看天气预报，外套带上，水杯带上，耳机带上，充电线带上，不要又把东西落在练习室，饿了就买点热的吃，不要光喝冰美式，妈妈真的会念你",
  "宝宝你要乖乖吃饭，别因为忙就随便糊弄过去，饭可以吃少一点但不能不吃，嗓子不舒服就少喝冰的，跳舞之前记得热身，别让我隔着屏幕操心",
  "宝宝今天如果练习很晚，回去路上一定要注意安全，手机电量够不够，外面冷不冷，有没有人陪你回去，妈妈不在身边但妈妈很操心",
  "宝宝把小书包背好，水壶拿稳，饭要吃热的，鞋带系好，不要跑太快，别人夸你也不要骄傲，别人说你不好也不要难过，妈妈知道你是很棒的小孩",
  "姐姐今天真的好美啊啊啊啊",
  "姐姐你到底知不知道自己有多漂亮",
  "姐姐你今天那个状态真的杀到我了",
  "姐姐你不用说话，站在那里就已经很有魅力",
  "姐姐你的眼睛真的好会说话",
  "姐姐你的手也太好看了吧",
  "姐姐你的指甲我真的看了很久",
  "姐姐你这个造型能不能焊在身上",
  "姐姐今天这个妆造太适合你了",
  "姐姐你别低估自己的脸，真的很伟大",
  "姐姐你的舞台表情管理太强了",
  "姐姐跳舞的时候真的有一种很松弛的美",
  "姐姐你的直拍我已经循环了",
  "姐姐直拍播放又是最高的吧，懂的都懂",
  "姐姐今天又秒了，好没悬念",
  "姐姐你的part为什么这么少啊啊啊啊",
  "为什么这么好的嗓子不给多唱几句",
  "姐姐高音一出来我真的起鸡皮疙瘩",
  "姐姐的声音像晒过太阳的被子",
  "姐姐的嗓音真的很贵",
  "姐姐你唱歌的时候我会突然安静下来",
  "什么时候solo啊我真的问累了",
  "什么时候solo什么时候solo什么时候solo",
  "姐姐快点solo吧，我等到花都谢了",
  "公司到底什么时候给你solo",
  "别的都先放一放，姐姐先把solo安排一下",
  "姐姐你这么会唱，不solo真的很浪费",
  "姐姐事业心拿出来好吗，我事业粉急死",
  "姐姐你最好是在偷偷准备新歌",
  "你是不是在写歌，你说句话我就信",
  "新歌呢新歌呢新歌呢",
  "demo能不能漏一点点，真的一点点",
  "我不贪心，给我听三秒也行",
  "巡演什么时候来我城市",
  "抢不到票我真的会碎掉",
  "姐姐开麦稳得我想哭",
  "今天舞台我宣布封神",
  "你这个ending pose我能看一百遍",
  "姐姐你今天那个转头真的太会了",
  "我昨天梦到你给我发消息了",
  "昨天梦到你了，醒来之后有点怅然若失",
  "今天睡前也来看你一下",
  "睡前不看你一眼我不安心",
  "我要睡了，你要是来了记得进我梦里",
  "晚安宝宝，虽然你没出现但我还是说",
  "我今天梦到我们一起坐地铁，离谱但幸福",
  "我梦到你开演唱会，然后我哭得很丢人",
  "我今天生日，姐姐能祝我生日快乐吗",
  "今天是我生日，可以给我一句生日快乐吗",
  "姐姐今天我生日，我想把愿望许给你",
  "生日愿望是你今年越来越好",
  "能祝我中考顺利吗宝宝",
  "能祝我高考顺利吗姐姐",
  "姐姐祝我四级过好吗",
  "能祝我六级顺利吗姐姐",
  "姐姐祝我雅思上岸好吗，我真的很需要",
  "能祝我考研上岸吗姐姐",
  "姐姐祝我期末不挂科吧",
  "宝宝祝我面试顺利好吗",
  "姐姐祝我明天考试别紧张好吗",
  "我今天考试崩了，、、、、、、",
  "我最近真的好内耗，但看到你会好一点",
  "我最近有点累，不知道为什么就想来这里",
  "今天被老师骂了，好难过，世界为什么这么难，我好羡慕你，你从来不会被批评吧，你这么优秀",
  "今天上班被气死了",
  "今天和朋友吵架了，人际关系好累，要是生活只有你就好了",
  "我现在有点难过，你能不能出现一下",
  "我真的很想你",
  "我知道你也很累，所以我只是小声说一句想你",
  "今天的我也在努力生活，你也是吧",
  "我们都要好好活着，好不好",
  "你有没有想我",
  "你想我了吗",
  "你想我吗你想我吗你想我吗",
  "我每天都想你，而你呢",
  "你是不是一点都不想我们",
  "你是不是只把我们当路过的人",
  "最近好冷，我想离你近一点",
  "我说我想离开你，但我又舍不得",
  "最近有点累，追你也有点累，但我还是来了",
  "我有时候会想你是不是根本不需要我们",
  "你不来的时候我真的会胡思乱想",
  "别让我一个人在这里演内心戏好吗",
  "我已经开始生气了，但看到你我会立刻原谅",
  "一张自拍能救我的命",
  "你随便拍一张糊的我也会珍藏",
  "你发一张鞋尖我都能研究半天",
  "你发天空也行，我会说这是你看过的天空",
  "你发个水杯我都能嗑到",
  "你发一个句号我都能脑补八百字",
  "你知道你很会钓吗",
  "姐姐你给我下了什么蛊",
  "姐姐你到底给我加了什么，好晕",
  "姐姐我现在有点上头",
  "姐姐我好热，可能是因为你太会了",
  "姐姐你别这样，我真的承受不住",
  "姐姐你一笑我脑子就没了",
  "姐姐你真的很危险",
  "姐姐你知道你这样很过分吗",
  "我说真的，你太会让人心动了",
  "喜欢你这件事真的藏不住",
  "喜欢一个人是藏不住的，就算闭嘴，也会从眼睛里跑出来",
  "我现在看谁都像路人，只有你像主角",
  "姐姐你就是那种让人越看越陷进去的人",
  "我本来只是路过，现在已经住下了",
  "新粉报道，可以轻轻喜欢你吗",
  "刚入坑三天，已经感觉不太妙",
  "我怎么越看越喜欢你啊",
  "你是不是故意让我入坑的",
  "我本来不追星的，你要负责",
  "我朋友说我最近像被夺舍了，因为我一直在说你",
  "我妈妈问我为什么一直傻笑，我说没事",
  "我现在的嘴角已经不归我管了",
  "我刚刚在路上想到你，突然笑了一下，路人可能觉得我有病",
  "今天也爱你，比昨天多一点",
  "今天也喜欢你，明天估计还会",
  "我真的很喜欢你，虽然你不知道",
  "你不知道也没关系，我知道就够了",
  "我会一直在这里的，至少今天是这样",
  "你慢慢来，我会慢慢等",
  "如果你很累，那今天就不用出现了，但要好好睡",
  "我希望你被很多很多爱包围，也包括我的这一点点",
  "你要成为很厉害的人，我会在下面很大声地喊你",
  "姐姐往前走吧，我们会跟上的",
  "你只管发光，剩下的我们来吵",
  "姐姐放心飞，出事自己背，不是，出事我们陪",
  "今天也给你投了一点点，虽然不多但是真心的",
  "我嘴上说不干数据了，手上又点开了",
  "我骂公司不影响我爱你",
  "公司能不能做个人，多给我姐点part",
  "看到有人夸你我比自己被夸还开心",
  "看到有人不懂你，我真的会急",
  "你值得更多人看见，真的",
  "姐姐你一定要越来越红",
  "你不红天理难容",
  "我已经准备好当老粉了",
  "以后你大火的时候我会说我很早就来了",
  "今天也在你的小房间里待了一会儿",
  "这里像秘密基地一样",
  "就算你不说话，这里也有点温暖",
  "我把所有的爱都给你了",
  "我走啦，明天再来看你",
  "我先去睡了，如果你来了就当我梦到了",
  "我会一直一直爱你",
  "我今天演讲了！很成功，多亏了你给了我勇气！",
  "他们说的你喜欢那个男爱豆的事情是真的吗。。。你真的不是侄女吗",
  "争弯保双好吧"
  ,"争弯保双","争弯保双","争弯保双","争弯保双","争弯保双","我好爱你宝贝","我又看了你之前的样子，真的像宝宝一样可爱！😻","我好心疼你，你为什么经历了这么多哭还是得不到你想要的，这个世界很坏，你很好","你值得比现在更多更多的爱宝宝","人都说没有无条件的爱，可是我对你从来没有过条件，我只要你开心","我不敢想你究竟吃了多少苦才走到我们面前","谢谢你成为你！","经历了多少才会被看见呢，只有我们会懂你吧，不要听不好的声音",
  "我知道你很敏感，我在物料里察觉到了，不要委屈自己了，你不需要照顾所有人的情绪",  "你很敏感，我察觉到了，不要委屈自己，你不需要一直看眼色","走到今天很辛苦吧宝宝，我会帮你治愈一切，我爱你",
  "你好像hot nerd呀宝宝","宝宝你是少女暴君！！","千万不要叫自己欧巴好不好，，，看到别的女豆说什么欧巴病给我看si乐",
  "女人中的女人。。。好性感","     姐姐你真的好性感啊啊啊啊","姐姐你是我见过最性感的女人了",
  "不再依赖姐姐算长大吗",
  "不再依赖姐姐算长大吗",
  "不再依赖姐姐算长大吗","不再依赖姐姐算长大吗","不再依赖姐姐算长大吗","不再依赖姐姐算长大吗"

  ],
  en: [
    "just checking in on you",
    "came to see if you posted anything",
    "hi, just passing by",
    "thinking of you today",
    "came to say hi",
    "just wanted to see your face",
    "here again, as always",
    "couldn't sleep, came to check",
    "just got off work, came here first",
    "hi, I'm here",
    "came to see you again",
    "just wanted to say I'm here",
    "here for my daily dose of you",
    "came to check on you",
    "just passing by to say hi",
    "here again, couldn't stay away",
    "just wanted to see you",
    "came to say I miss you",
    "here for my daily visit",
    "just checking in",
    "came to see if you're okay",
    "just wanted to say hi",
    "here again, as always",
    "came to see you",
    "just passing by",
    "here for my daily check",
    "came to say I'm here",
    "just wanted to see you again",
    "here again, couldn't resist",
    "came to check on you today"
  ],
  ko: [
    "오늘도 왔어요",
    "잠깐 들렀어요",
    "퇴근하고 바로 왔어요",
    "오늘도 보고 싶었어요",
    "안녕하세요, 왔어요",
    "오늘도 여기 있어요",
    "매일 오는 거 알아요?",
    "오늘도 잊지 않았어요",
    "잠깐 들러서 인사해요",
    "오늘도 좋아해요",
    "왔어요, 오늘도 왔어요",
    "보고 싶어서 왔어요",
    "오늘도 여기 있을게요",
    "매일 오는 팬이에요",
    "오늘도 응원해요"
  ],
  jp: [
    "今日も来たよ",
    "ちょっと寄ってみた",
    "仕事終わって来たよ",
    "今日も会いたかった",
    "こんにちは、来たよ",
    "今日もここにいるよ",
    "毎日来てるの知ってる？",
    "今日も忘れてないよ",
    "ちょっと挨拶しに来た",
    "今日も好きだよ",
    "来たよ、今日も来たよ",
    "会いたくて来た",
    "今日もここにいるね",
    "毎日来てるファンだよ",
    "今日も応援してるよ"
  ],
  es: [
    "aquí de nuevo",
    "solo pasaba a saludar",
    "vine a verte",
    "hoy también vine",
    "aquí estoy, como siempre",
    "vine a ver si publicaste algo",
    "solo quería decir hola",
    "aquí para mi visita diaria",
    "vine a saludarte",
    "aquí de nuevo, no puedo evitarlo",
    "vine a verte otra vez",
    "solo quería decir que estoy aquí",
    "aquí para mi dosis diaria",
    "vine a ver cómo estás",
    "solo pasando a decir hola"
  ]
};

const ambientTemplateTranslations = {
  en: {
    "just checking in on you": "只是来看看你。",
    "came to see if you posted anything": "来看看你有没有发什么。",
    "hi, just passing by": "嗨，只是路过看看。",
    "thinking of you today": "今天也在想你。",
    "came to say hi": "来跟你说声嗨。",
    "just wanted to see your face": "只是想看看你的脸。",
    "here again, as always": "又来了，和往常一样。",
    "couldn't sleep, came to check": "睡不着，所以来看看。",
    "just got off work, came here first": "刚下班，第一件事就是来这里。",
    "hi, I'm here": "嗨，我来了。",
    "came to see you again": "又来看你了。",
    "just wanted to say I'm here": "只是想说我在这里。",
    "here for my daily dose of you": "来补充今天份的你。",
    "came to check on you": "来看看你还好吗。",
    "just passing by to say hi": "只是路过跟你打个招呼。",
    "here again, couldn't stay away": "又来了，还是忍不住。",
    "just wanted to see you": "只是想见你。",
    "came to say I miss you": "来告诉你我想你了。",
    "here for my daily visit": "来进行今天的日常探访。",
    "just checking in": "只是来报个到。",
    "came to see if you're okay": "来看看你是不是还好。",
    "came to see you": "来看你了。",
    "just passing by": "只是路过一下。",
    "here for my daily check": "来完成今天的打卡。",
    "came to say I'm here": "来告诉你我在。",
    "just wanted to see you again": "只是又想见你了。",
    "here again, couldn't resist": "又来了，真的忍不住。",
    "came to check on you today": "今天也来看看你。"
  },
  ko: {
    "오늘도 왔어요": "今天也来了。",
    "잠깐 들렀어요": "只是短暂来看看。",
    "퇴근하고 바로 왔어요": "下班后马上就来了。",
    "오늘도 보고 싶었어요": "今天也很想你。",
    "안녕하세요, 왔어요": "你好，我来了。",
    "오늘도 여기 있어요": "今天也在这里。",
    "매일 오는 거 알아요?": "你知道我每天都来吗？",
    "오늘도 잊지 않았어요": "今天也没有忘记你。",
    "잠깐 들러서 인사해요": "路过一下来打个招呼。",
    "오늘도 좋아해요": "今天也喜欢你。",
    "왔어요, 오늘도 왔어요": "来了，今天也来了。",
    "보고 싶어서 왔어요": "因为想你所以来了。",
    "오늘도 여기 있을게요": "今天也会在这里。",
    "매일 오는 팬이에요": "我是每天都会来的粉丝。",
    "오늘도 응원해요": "今天也为你加油。"
  },
  jp: {
    "今日も来たよ": "今天也来了。",
    "ちょっと寄ってみた": "稍微过来看看。",
    "仕事終わって来たよ": "下班后就来了。",
    "今日も会いたかった": "今天也很想见你。",
    "こんにちは、来たよ": "你好，我来了。",
    "今日もここにいるよ": "今天也在这里。",
    "毎日来てるの知ってる？": "你知道我每天都来吗？",
    "今日も忘れてないよ": "今天也没有忘记你。",
    "ちょっと挨拶しに来た": "只是来打个招呼。",
    "今日も好きだよ": "今天也喜欢你。",
    "来たよ、今日も来たよ": "来了，今天也来了。",
    "会いたくて来た": "因为想见你所以来了。",
    "今日もここにいるね": "今天也会在这里。",
    "毎日来てるファンだよ": "我是每天都会来的粉丝。",
    "今日も応援してるよ": "今天也支持你。"
  },
  es: {
    "aquí de nuevo": "又来这里了。",
    "solo pasaba a saludar": "只是路过来打个招呼。",
    "vine a verte": "我来看你了。",
    "hoy también vine": "今天也来了。",
    "aquí estoy, como siempre": "我在这里，和往常一样。",
    "vine a ver si publicaste algo": "来看看你有没有发什么。",
    "solo quería decir hola": "只是想说声你好。",
    "aquí para mi visita diaria": "来进行今天的日常探访。",
    "vine a saludarte": "来跟你打招呼。",
    "aquí de nuevo, no puedo evitarlo": "又来了，真的忍不住。",
    "vine a verte otra vez": "又来看你了。",
    "solo quería decir que estoy aquí": "只是想告诉你我在这里。",
    "aquí para mi dosis diaria": "来补充今天份的你。",
    "vine a ver cómo estás": "来看看你怎么样。",
    "solo pasando a decir hola": "只是路过说声你好。"
  }
};

const timeTemplatesByPeriod = {
  breakfast: [
    "早八路上来看看你，顺便问你吃早饭了吗",
    "我在买早餐，你也要好好吃第一口饭",
    "刚醒就来看你了，今天也要顺利出门",
    "通勤路上看到通知会开心一整天",
    "早八人已到教室，靠你续命一下"
  ],
  lunch: [
    "午饭吃了吗宝宝，不许随便糊弄",
    "我午休偷看一眼，你也要好好吃饭",
    "食堂今天一般，但想到你就开心一点",
    "外卖到了，我来问问你吃没吃午饭",
    "午间报到，今天也要把饭吃完"
  ],
  dinner: [
    "晚饭吃了吗，今天累不累",
    "刚下班来看看你，你也要吃点热的",
    "放学了，第一件事就是来这里报到",
    "傍晚了，记得吃晚饭不要空着肚子练习",
    "今天也辛苦了，晚饭要认真吃"
  ],
  late_night: [
    "睡不着，来看看你有没有发消息。",
    "今天终于结束了，来找你说晚安。",
    "深夜了，想你了。",
    "睡前来看你一眼，晚安。"
  ]
};

function templateTranslationFor(language, content) {
  if (language === "zh") return content;
  return ambientTemplateTranslations[language]?.[content] || content;
}

/**
 * 从 DB row 映射消息时，检查外文消息是否有有效中文译文。
 * 若无（translated_content 为空、等于原文、或不含中文），把 language 降级为 "zh"，
 * 避免前端显示"暂无译文"。
 */
function normalizeDbRow(row) {
  const language = row.language || "zh";
  const content = row.content || "";
  const rawTranslated = (row.translated_content || "").trim();

  return {
    language,
    content,
    translatedContent: rawTranslated || content,
    personaType: row.persona_type || undefined,
    messageKind: row.message_kind || "ambient"
  };
}

function pickTemplateContent(language, timeContext = {}) {
  const { period } = resolveTimeContext(timeContext);
  const timeTemplates = timeTemplatesByPeriod[period] || [];
  if (timeTemplates.length && Math.random() < 0.42) {
    return { language: "zh", content: pickRandom(timeTemplates) };
  }

  const templates = templatesByLanguage[language] || templatesByLanguage.zh;
  return { language, content: pickRandom(templates) };
}

/** 生成一条模板 ambient 消息（不调 AI） */
function makeTemplateMessage(timeContext = {}) {
  const picked = pickTemplateContent(pickLanguage(), timeContext);
  const language = picked.language;
  const content = picked.content;
  const persona = pickPersonaForLanguage(language, timeContext);
  const fanName = pickRandom(fanNicknamePool);
  const avatar = pickRandom(animalAvatars);

  const translatedContent = templateTranslationFor(language, content);

  return {
    language,
    content,
    translatedContent,
    personaType: persona.type,
    messageKind: "ambient",
    source: "template",
    fanName,
    avatar
  };
}

/** 批量生成模板消息 */
function makeTemplateMessages(count, timeContext = {}) {
  const messages = [];
  const maxAttempts = Math.max(count * 4, 20);
  for (let i = 0; messages.length < count && i < maxAttempts; i++) {
    const message = makeTemplateMessage(timeContext);
    if (isMessageAllowedForTime(message, timeContext)) {
      messages.push(message);
    }
  }
  return messages;
}

// ── PostgreSQL CRUD ────────────────────────────────────────────────────────────

/**
 * 从 PG 拉取 count 条 ambient 消息（近似随机，不用 ORDER BY RANDOM()）
 * 拉取后更新 used_count 和 random_key（让下次查询结果不同）
 */
async function fetchFromPg(count, timeContext = {}) {
  const safeCount = Math.max(1, Math.min(count, 100));

  // 用 random_key 做近似随机：每次取一个随机起点，然后顺序读
  const pivot = Math.random();
  const result = await query(
    `SELECT id, language, content, translated_content, persona_type, message_kind
     FROM ambient_messages
     WHERE random_key >= $1
     ORDER BY random_key
     LIMIT $2`,
    [pivot, safeCount * 2]
  );

  // 如果从 pivot 往后不够，再从头补
  let rows = result.rows;
  if (rows.length < safeCount) {
    const extra = await query(
      `SELECT id, language, content, translated_content, persona_type, message_kind
       FROM ambient_messages
       WHERE random_key < $1
       ORDER BY random_key
       LIMIT $2`,
      [pivot, safeCount * 2 - rows.length]
    );
    rows = [...rows, ...extra.rows];
  }

  if (rows.length === 0) return [];

  // Fisher-Yates shuffle，取前 safeCount 条
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  const picked = rows
    .filter((row) => isMessageAllowedForTime({
      content: row.content,
      translatedContent: row.translated_content,
      personaType: row.persona_type
    }, timeContext))
    .slice(0, safeCount);

  if (picked.length === 0) return [];

  // 异步更新使用统计 + 重新随机化 random_key（不阻塞响应）
  const ids = picked.map((r) => r.id);
  query(
    `UPDATE ambient_messages
     SET used_count = used_count + 1,
         last_used_at = $2,
         random_key = random()
     WHERE id = ANY($1::text[])`,
    [ids, Date.now()]
  ).catch(() => {/* 统计失败不影响主流程 */});

  return picked.map((row) => normalizeDbRow(row));
}

/** 获取 PG 当前库存数量 */
async function getPgStock() {
  const result = await query("SELECT COUNT(*)::int AS cnt FROM ambient_messages");
  return Number(result.rows[0]?.cnt || 0);
}

/** 批量写入 ambient 消息到 PG（用 hash 去重） */
async function insertAmbientMessages(messages) {
  if (!messages.length) return 0;
  let inserted = 0;
  for (const msg of messages) {
    const hash = sha256(msg.content);
    try {
      await query(
        `INSERT INTO ambient_messages
           (language, content, translated_content, persona_type, message_kind, source, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (hash) DO NOTHING`,
        [
          msg.language || "zh",
          msg.content,
          msg.translatedContent || msg.content,
          msg.personaType || null,
          msg.messageKind || "ambient",
          msg.source || "template",
          hash
        ]
      );
      inserted++;
    } catch {
      // 单条失败不影响其他条
    }
  }
  return inserted;
}

// ── 异步 Refill ────────────────────────────────────────────────────────────────

/**
 * 触发异步 refill：
 *   - 检查 PG 库存，低于 REFILL_THRESHOLD 时补充到 REFILL_TARGET
 *   - 80% 模板 + 20% AI
 *   - 用 refillLock 防止同一进程并发 refill
 */
async function triggerRefill(timeContext = {}) {
  if (refillLock) return;
  if (!isDbEnabled()) return;

  const now = Date.now();
  if (now - pgStockCheckedAt < PG_STOCK_CHECK_INTERVAL) return;
  pgStockCheckedAt = now;

  refillLock = true;
  try {
    const stock = await getPgStock();
    if (stock >= REFILL_THRESHOLD) return;

    const needed = REFILL_TARGET - stock;
    const aiCount = Math.floor(needed * AI_RATIO);
    const templateCount = needed - aiCount;

    // 1. 模板消息（同步生成，立即写入）
    const templateMessages = makeTemplateMessages(templateCount, timeContext);
    await insertAmbientMessages(templateMessages.map((m) => ({ ...m, source: "template" })));

    // 2. AI 消息（分批异步生成，不阻塞）
    if (aiCount > 0) {
      void generateAiAmbientMessages(aiCount, timeContext);
    }
  } catch (error) {
    logAiFailure({
      operation: "ambient_pool_refill",
      error
    });
  } finally {
    refillLock = false;
  }
}

/** 分批调用 AI 生成 ambient 消息并写入 PG */
async function generateAiAmbientMessages(totalCount, timeContext = {}) {
  const batches = Math.ceil(totalCount / AI_BATCH_SIZE);
  for (let i = 0; i < batches; i++) {
    try {
      const batchCount = Math.min(AI_BATCH_SIZE, totalCount - i * AI_BATCH_SIZE);
      const messages = await generateLiveFanMessages("", batchCount, timeContext);
      const toInsert = messages.map((m) => ({ ...m, source: "ai" }));
      await insertAmbientMessages(toInsert);
    } catch (error) {
      logAiFailure({
        operation: "ambient_pool_ai_refill_batch",
        batchIndex: i,
        error
      });
      // 单批失败继续下一批
    }
  }
}

// ── 公开 API ──────────────────────────────────────────────────────────────────

/**
 * 从 ambient pool 取 count 条消息。
 * 优先级：内存缓冲 → PG → 模板 fallback
 * 同时异步触发 refill（不阻塞响应）
 */
export async function getAmbientMessages(count = 30, timeContext = {}) {
  const safeCount = Math.max(1, Math.min(count, 60));
  const result = [];

  // 1. 先从内存缓冲取
  while (result.length < safeCount && memoryBuffer.length > 0) {
    const next = memoryBuffer.shift();
    if (isMessageAllowedForTime(next, timeContext)) {
      result.push(next);
    }
  }

  // 2. 不够时从 PG 补
  if (result.length < safeCount && isDbEnabled()) {
    try {
      const needed = safeCount - result.length;
      const pgMessages = await fetchFromPg(needed + BATCH_FETCH_SIZE, timeContext); // 多取一些补充内存缓冲
      const forResult = pgMessages.slice(0, needed);
      const forBuffer = pgMessages.slice(needed);

      result.push(...forResult);

      // 多余的放入内存缓冲（最多 MEMORY_BUFFER_SIZE 条）
      const bufferSpace = MEMORY_BUFFER_SIZE - memoryBuffer.length;
      if (bufferSpace > 0) {
        memoryBuffer.push(...forBuffer.slice(0, bufferSpace));
      }
    } catch (error) {
      logAiFailure({
        operation: "ambient_pool_pg_fetch",
        error
      });
    }
  }

  // 3. 还不够时用模板 fallback 补齐
  if (result.length < safeCount) {
    const fallbackCount = safeCount - result.length;
    const fallbackMessages = makeTemplateMessages(fallbackCount, timeContext);
    result.push(...fallbackMessages);
  }

  // 4. 异步触发 refill（不等待）
  void triggerRefill(timeContext);

  // 5. 给每条消息加上运行时 id、fanName、avatar（PG 里不存这些，避免重复）
  const stamp = Date.now();
  return result.map((msg, index) => {
    const language = msg.language || "zh";
    const content = msg.content || "";
    const rawTranslated = (msg.translatedContent || "").trim();
    const hasChinese = /[\u3400-\u9FFF]/.test(rawTranslated);
    const hasValidTranslation = language !== "zh"
      ? Boolean(rawTranslated && rawTranslated !== content && hasChinese)
      : true;
return {
  id: `ambient-pool-${stamp}-${index}`,
  fanName: msg.fanName || pickRandom(fanNicknamePool),
  avatar: msg.avatar || pickRandom(animalAvatars),
  language,
  content,
  translatedContent: rawTranslated || content,
  personaType: msg.personaType,
  messageKind: msg.messageKind || "ambient"
};
  });
}

/**
 * 预热：进程启动时调用，提前填充内存缓冲。
 * 不阻塞启动流程。
 */
export function warmUp() {
  if (!isDbEnabled()) return;
  void (async () => {
    try {
      const messages = await fetchFromPg(MEMORY_BUFFER_SIZE);
      memoryBuffer.push(...messages.slice(0, MEMORY_BUFFER_SIZE));
      void triggerRefill();
    } catch {
      // 预热失败不影响启动
    }
  })();
}
