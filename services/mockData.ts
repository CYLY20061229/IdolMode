import { Artist, ChatMessage, FanMessage, IdolChatThread, Poll, Profile } from "@/types/idol";

export const myProfile: Profile = {
  id: "me",
  nickname: "月野 Luna",
  signature: "今晚也在练习。",
  email: "",
  avatar: "月",
  gender: "female",
  age: null
};

export const recommendedArtists: Artist[] = [
  {
    id: "artist-1",
    nickname: "mira",
    avatar: "mira",
    background: "#EADDF8",
    bio: "组合FIFTEEN主唱",
    signature: "永远喜欢fifties！",
    identity: "爱豆",
    fans: "82.4K",
    intro: "mira 是韩国人气女团 FIFTEEN 的主唱，喜欢在练习室和粉丝分享一些小日常和练习点滴。"
  },
  {
    id: "artist-2",
    nickname: "Nova Rin",
    avatar: "NR",
    background: "#DCEEFF",
    bio: "菲律宾新兴艺人，新曲《grey》正在推广中！",
    signature: "Love wins",
    identity: "独立歌手",
    fans: "146K",
    intro: "Nova 是一位来自菲律宾的独立歌手，喜欢在社交媒体上和粉丝分享一些生活中的小确幸，还有一些写歌的灵感来源。"
  },
  {
    id: "artist-3",
    nickname: "Eden Skye",
    avatar: "ES",
    background: "#F3D7E5",
    bio: "欧洲乐队OTS主唱，融合摇滚与R&B元素的创作型歌手。",
    signature: "I will sing until the world ends.",
    identity: "乐队主唱",
    fans: "57.9K",
    intro: "Eden 是独立乐队的主唱，喜欢把排练日记和没说出口的心情发给粉丝。"
  },
  {
    id: "artist-4",
    nickname: "王亿灵",
    avatar: "王",
    background: "#E3F4E8",
    bio: "舞者转型的流行歌手，在中国拥有人气偶像的地位。",
    signature: "再向你靠近一步。",
    identity: "舞者",
    fans: "39.1K",
    intro: "亿灵喜欢在练习室里和粉丝分享一些练舞的趣事，还有一些生活中的小感悟。"
  }
];

export const addedArtists: Artist[] = [recommendedArtists[0]];

export const selfChatMessages: ChatMessage[] = [
  {
    id: "self-1",
    sender: "self",
    text: "今天练习结束得很晚，但我从练习室窗户看到了月亮，像一场很小的安可。",
    status: "sent",
    createdAt: "22:18"
  }
];

export const idolChatMessages: IdolChatThread[] = [
  {
    artistId: "artist-1",
    messages: [
      {
        id: "mira-1",
        sender: "artist",
        text: "今天排练有了一些灵感，或许会是一首很好的歌！",
        createdAt: "21:02"
      },
      {
        id: "mira-2",
        sender: "artist",
        text: "替我多喝点水好吗？",
        createdAt: "21:35"
      }
    ]
  },
  {
    artistId: "artist-2",
    messages: [
      {
        id: "nova-1",
        sender: "artist",
        text: "",
        createdAt: "20:11"
      }
    ]
  },
  {
    artistId: "artist-3",
    messages: [
      {
        id: "eden-1",
        sender: "artist",
        text: "嗓子有点累，还遇到一群teenagers，FXCK",
        createdAt: "23:04"
      }
    ]
  },
  {
    artistId: "artist-4",
    messages: [
      {
        id: "sora-1",
        sender: "artist",
        text: "今天又去练舞！",
        createdAt: "19:47"
      }
    ]
  }
];

export const artistBubbleMessagePools: Record<string, string[]> = {
  "artist-1": [
    "刚刚下练习，鞋带又松了三次。",
    "今天录音的时候突然很想吃热汤。",
    "老师说我这次高音稳了一点点，我偷偷开心了。",
    "如果你现在也累，就和我一起休息五分钟。",
    "今天妆发很顺利，拍了几张存货，之后给你看。",
    "刚才成员说我笑点太低，我承认。",
    "练习室空调有点冷，但今天状态还不错。",
    "你今天有没有好好吃饭？我有认真吃。"
  ],
  "artist-2": [
    "grey 的副歌今天又改了一版，好像更贴近我想要的感觉。",
    "刚刚听到一段雨声，突然有新的旋律了。",
    "今天有点安静，但不是坏心情。",
    "谢谢你还在听我的歌，这件事对我很重要。",
    "我在写一小段和海有关的歌词。",
    "今晚想把灯调暗一点工作。",
    "你觉得灰色是冷的还是温柔的？",
    "今天拍摄结束，头发被风吹得很乱。"
  ],
  "artist-3": [
    "排练室的鼓今天吵得我脑袋嗡嗡的。",
    "写了一句歌词，但还没想好要不要留下。",
    "嗓子还行，别担心，我有喝水。",
    "今天贝斯线很好听，差点抢走我的注意力。",
    "如果下一场演出你在台下，我会唱得更用力一点。",
    "刚才突然想起第一场小演出的灯。",
    "我不太会说漂亮话，但我真的看到了你的留言。",
    "今天的天空像一块旧胶片。"
  ],
  "artist-4": [
    "今天练了新的转身，差点把自己转晕。",
    "拉伸的时候听到外面有人在笑，心情突然好了。",
    "晚饭吃了面，练舞前不敢吃太多。",
    "老师说我的手臂线条更干净了，记下来。",
    "今天汗流得很夸张，但很爽。",
    "你要是看到练习室地板，可能会笑我。",
    "刚刚复盘视频，发现一个小表情还不错。",
    "明天想早点去练习室。"
  ]
};

const artistPoolIndexes: Record<string, number> = {};

export function generateArtistBubbleMessage(artistId: string): string {
  const pool = artistBubbleMessagePools[artistId] ?? [
    "今天也有在认真生活。",
    "刚刚看到你的消息了，谢谢你。",
    "有些话想慢慢说给你听。",
    "你也要照顾好自己。"
  ];
  const index = artistPoolIndexes[artistId] ?? Math.floor(Math.random() * pool.length);
  artistPoolIndexes[artistId] = index + 1;
  return pool[index % pool.length];
}

export const fanMessages: FanMessage[] = [
  {
    id: "fan-1",
    fanName: "小雨",
    avatar: "🐰",
    language: "zh",
    content: "我爱你",
    translatedContent: "我爱你"
  },
  {
    id: "fan-2",
    fanName: "momo",
    avatar: "🐱",
    language: "en",
    content: "You always show up when I need comfort the most.",
    translatedContent: "你总是在我最需要安慰的时候出现。"
  },
  {
    id: "fan-3",
    fanName: "하늘",
    avatar: "🐶",
    language: "ko",
    content: "오늘도 와줘서 고마워요 🥺",
    translatedContent: "谢谢你今天也来了。"
  },
  {
    id: "fan-4",
    fanName: "星野",
    avatar: "🐼",
    language: "jp",
    content: "短いメッセージなのに、すごく救われた気がする。",
    translatedContent: "明明只是很短的一句话，却感觉被拯救了。"
  },
  {
    id: "fan-5",
    fanName: "Lia",
    avatar: "🦊",
    language: "es",
    content: "No desaparezcas tanto, te extrañamos mucho.",
    translatedContent: "不要消失太久，我们真的很想你。"
  },
  {
    id: "fan-6",
    fanName: "甜桃",
    avatar: "🐻",
    language: "zh",
    content: "爱你",
    translatedContent: "爱你"
  }
];

const emojiReplies = ["💜🥹✨", "😭😭😭", "🫶🌙", "💌💌💌", "🥺💜"];
const fanAvatarPool = ["🐰", "🐱", "🐶", "🐼", "🦊", "🐻", "🐹", "🐨", "🐯", "🦁", "🐮", "🐸", "🐵", "🐧", "🐥", "🦄", "🐺", "🐙", "🦔", "🦦"];
const normalFanNicknamePool = [
  "宝宝", "宝贝", "亲爱的", "老婆", "老公", "乖乖", "宝宝酱", "宝子", "小宝", "小宝宝",
  "我的宝宝", "宝宝本人", "亲亲宝宝", "宝贝疙瘩", "小乖乖", "乖宝", "甜心", "心肝", "崽崽", "女儿",
  "妈咪的小孩", "姐的小宝", "小朋友", "小可爱", "小笨蛋", "小漂亮", "小甜豆", "小软包", "小棉袄", "小祖宗",
  "宝宝你看看我", "亲爱的你来了", "老婆回我一下", "宝贝今天好吗", "小孩别太累", "乖乖快睡觉",
  "小羊", "小猪", "小猫", "小狗", "小兔", "小熊", "小鹿", "小鱼", "小狐狸", "小企鹅",
  "小海豹", "小仓鼠", "小奶猫", "小狗勾", "小兔叽", "羊咩咩", "猪猪", "猫猫", "狗狗", "兔兔",
  "熊宝", "小熊饼干", "小狗饼", "一只小羊", "一只小猪", "一只小猫", "小羊羔", "小猪包", "修狗", "猫猫头",
  "甜桃", "柚子冰", "奶油卷", "小奶糖", "软糖", "半糖", "糖豆", "布丁", "芋泥", "奶盖",
  "小蓝莓", "小草莓", "小葡萄", "小橘子", "小柠檬", "桃桃", "莓莓", "橘宝", "糯米团", "芝士球",
  "椰奶冻", "小蛋糕", "小饼干", "奶黄包", "红豆冰", "白桃乌龙", "草莓牛奶", "焦糖布丁", "芋圆啵啵", "甜豆花",
  "冰美式少冰", "多肉葡萄", "珍珠奶茶", "芝士奶盖", "一颗糖", "白桃冻冻", "小年糕", "糯叽叽",
  "今天营业了吗", "等你发消息", "速速发歌", "已老实求营业", "你怎么还不回我", "今天也在等你",
  "路过被你蛊到", "被你拿捏", "谁懂啊", "憋气到宝宝回复我", "别管我我很幸福", "每天都想见你",
  "求你多说两句", "别太会营业", "你真的很过分", "你知道我在等吗", "求你看看我", "我在等饭",
  "今天有饭吗", "饭呢饭呢", "蹲一个晚安", "等你说晚安", "看到你就开心", "今天也喜欢你",
  "事业批来了", "冷面打投人", "什么时候拿一位", "快去投票", "宣传委员", "什么时候回归",
  "新歌在哪里", "专辑什么时候发", "巡演一定要抢到票", "打歌开麦了吗", "别光聊天快写歌",
  "新歌催更bot", "巡演什么时候", "新歌剧透剧透剧透", "别谈恋爱快回归",
  "momo", "Riri", "Nini", "Lia", "Jae", "Mika", "Noa", "Cata", "Mar", "Sol",
  "Luna", "Mina", "Yuki", "Nana", "Mimi", "Kiki", "Bibi", "Lulu", "Dodo", "Coco",
  "Honey", "Baby", "Dear", "Sweetie", "Bunny", "Kitty", "Mochi", "Peachy", "Berry", "Sunny",
  "하늘", "나비", "하루", "민트", "별밤", "유나", "달빛", "보라", "소라", "아기",
  "자기", "토끼", "고양이", "복숭아", "구름", "별이",
  "星野", "そら", "ミオ", "月子", "りん", "小町", "ゆき", "はる", "もも", "なな",
  "ひかり", "あおい", "こはる", "さくら", "うさぎ", "ねこ",
  "Luz", "Miel", "Nube", "Tina", "Cielo", "Nina", "Bella", "Dulce", "Lina", "Amor",
  "Chérie", "Lumi", "Étoile", "Bijou", "Lune"
];
const chaoticFanNicknamePool = [
  "法友", "精神状态良好", "不想上班", "期末周复习中", "不吃香菜已黑化", "不吃香菜已老实",
  "彻底疯狂", "我的爸呀大哥", "阴暗老鼠人", "我真的会谢", "什么时候鸟我", "鸟鸟我好不好",
  "老爹站编外人员", "老爹站重生版", "想偷你的麦克风", "想住进你的耳返", "想当你的保温杯",
  "想当你的手机壳", "想当你的充电线", "想当你的舞台灯", "想当你的歌词本", "想当你的猫",
  "想当你的狗", "让我当你家门口的树", "我可以当背景板", "我愿意当伴舞地板", "让我做你的空气",
  "让我做你的影子", "你一句话我活三天", "想当你的拖鞋", "想当你的帽子", "想当你的耳机线",
  "想当你的便利贴", "想当你的行李箱", "让我住进你的歌单"
];
const toxicFanNicknamePool = [
  "怎么还不营业", "今天营业了吗", "你还知道回来", "营业很难吗", "少装神秘", "你最好有事",
  "今天必须营业", "营业欠费了吗", "又装消失是吧", "你是不是忘了我们", "不再依赖姐姐算长大吗",
  "作品呢作品呢", "专辑什么时候发", "舞台在哪里", "姐姐的小狗", "你能不能争气点",
  "崩溃", "都去投票，你也去", "姐姐注意身体", "回归倒计时", "今天练声了吗",
  "姐姐的唯一", "妈妈爱你", "妈妈", "老婆", "想做姐姐的狗",
  "想吃姐姐的。。。", "恋爱禁止bot", "恋爱达咩", "想吃你", "赤壁",
  "事业上升期别恋爱", "不要留美甲", "单身否"
];
let emojiIndex = 0;
let liveFanIndex = 0;

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomFanAvatar() {
  return randomItem(fanAvatarPool);
}

function hasCJK(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function hasKoreanOrJapanese(text: string) {
  return /[\u3040-\u30ff\uac00-\ud7af]/.test(text);
}

const zhNormalNicknamePool = normalFanNicknamePool.filter((name) => hasCJK(name) && !hasKoreanOrJapanese(name));
const foreignNicknamePool = normalFanNicknamePool.filter((name) => !hasCJK(name) || hasKoreanOrJapanese(name));

function nextFanNickname(language: string = "zh") {
  const random = Math.random();

  if (language !== "zh") {
    const useForeign = Math.random() < 0.75;
    const pool = useForeign ? foreignNicknamePool : zhNormalNicknamePool;
    return randomItem(pool.length ? pool : normalFanNicknamePool);
  }

  if (random < 0.08) {
    return randomItem(toxicFanNicknamePool);
  }

  if (random < 0.28) {
    return randomItem(chaoticFanNicknamePool);
  }

  return randomItem(zhNormalNicknamePool.length ? zhNormalNicknamePool : normalFanNicknamePool);
}

function normalizeContent(text: string) {
  return text
    .replace(/\s+/g, "")
    .replace(/[，。！？,.!?~～…🥺😭💜✨🫶🌙]/g, "")
    .toLowerCase();
}

const recentContentKeys: string[] = [];
const recentFanNames: string[] = [];
const recentPersonaTypes: string[] = [];
const recentLanguages: string[] = [];

function rememberMessage(message: FanMessage) {
  recentContentKeys.push(normalizeContent(message.content));
  recentFanNames.push(message.fanName);
  recentPersonaTypes.push(message.personaType ?? "unknown");
  recentLanguages.push(message.language);

  if (recentContentKeys.length > 200) recentContentKeys.shift();
  if (recentFanNames.length > 40) recentFanNames.shift();
  if (recentPersonaTypes.length > 40) recentPersonaTypes.shift();
  if (recentLanguages.length > 40) recentLanguages.shift();
}

function isTooRepetitive(message: FanMessage) {
  const key = normalizeContent(message.content);

  if (recentContentKeys.includes(key)) return true;

  const sameNameCount = recentFanNames.slice(-20).filter((name) => name === message.fanName).length;
  if (sameNameCount >= 2) return true;

  const samePersonaCount = recentPersonaTypes
    .slice(-10)
    .filter((persona) => persona === message.personaType).length;
  if (samePersonaCount >= 3) return true;

  const sameLanguageCount = recentLanguages
    .slice(-6)
    .filter((language) => language === message.language).length;
  if (sameLanguageCount >= 4 && message.language !== "zh") return true;

  return false;
}

function pickLanguage(preferZh = true): FanMessage["language"] {
  if (preferZh) {
    const random = Math.random();

    if (random < 0.7) return "zh";
    if (random < 0.8) return "en";
    if (random < 0.88) return "ko";
    if (random < 0.96) return "jp";
    return "es";
  }

  return randomItem<FanMessage["language"]>(["zh", "en", "ko", "jp", "es"]);
}

const localPrefixes = [
  "",
  "",
  "我觉得","不是","不是","姐姐","啊","啊","嗯","","","","","","","","","","","","","","","","","","","","","","",
  "呃呃",
  "说真的，",
  "不知道咋的，",
  "我刚刚又觉得，",
  "其实，",
  "妈呀，",
  "爸呀大哥，",
  "呃"
  
];

const localSuffixes = [
  "",
  "😶",
  "🤩",
  "🥺","🥺","🥺","🥺","🥺","🥺","🥺",
  "真的。","","","我已急哭","","","","","","","","","","","","","","","","","","","","","","","","","","","",
  "别嫌我啰嗦。",
"","我肚肚","我肚肚","我肚肚","我肚肚","是吧","kkkk","kkkk","kkkk","kkkkkkk","kkkkkkkk","heart软软","heart软软","heart软软","heart软软","","","","","","","","","","","","","","","",
];

function addLocalVariation(content: string, personaType: string) {
  if (content.length > 45) return content;

  const shouldAddPrefix = Math.random() < 0.22;
  const shouldAddSuffix = Math.random() < 0.28;

  let result = content;

  if (shouldAddPrefix) {
    result = `${randomItem(localPrefixes)}${result}`;
  }

  if (shouldAddSuffix) {
    const suffix = randomItem(localSuffixes);

    if (suffix && !result.endsWith("。") && !result.endsWith("！") && !result.endsWith("?") && !result.endsWith("？")) {
      result += "。";
    }

    result += suffix;
  }

  if (personaType === "chaotic meme fan" && Math.random() < 0.25) {
    result += randomItem(["我疯了。", "别管了。", "我肚肚。"]);
  }

  return result;
}

function fillTemplate(template: string, slots: Record<string, string[]>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const values = slots[key] ?? [""];
    return randomItem(values);
  });
}

const templateSlots = {
  careAction: ["好好吃饭", "按时睡觉", "多喝水", "穿多一点", "别太累"],
  careEmotion: ["担心", "惦记", "放心不下", "操心", "忍不住关心"],
  dailyScene: ["刚下课", "刚下班", "刚从图书馆回来", "刚洗完澡", "坐地铁的时候", "考完试之后"],
  dailyFeeling: ["有点累", "肚肚要炸了", "突然特别想你", "感觉终于熬过了一天", "感觉人生太难了"],
  waitingTime: ["五分钟", "十分钟", "一会儿", "到你出现为止"],
  oldFood: ["旧自拍", "上次的消息", "以前的舞台", "之前的 demo", "那张旧照片"],
  musicThing: ["新歌", "demo", "舞台", "练习室版本", "下一次现场", "副歌","舞蹈版本mv","专辑", "巡演"],
  reactionFeeling: ["heart软软", "破防", "眼睛尿尿了", "突然被治愈到", "又开始想你"]
};

const personaTemplates: Record<string, string[]> = {
  "mom fan": [
    "你今天有没有{careAction}，我真的{careEmotion}",
    "不发消息也没关系，记得{careAction}",
    "宝宝，{careAction}不能能糊弄过去的哦。",
    "我真的想你，爱你，有没有{careAction}",
    "你可以少发一点，但不能不好好{careAction}",
    "你是我的星星 最闪亮的存在"
  ],
  "sleep police": [
    "下班了吗宝",
    "我好累啊今天工作太辛苦了",
    "我还有一个月考试了，但是你要好好休息，你是我的一切",
    "我好想你啊",
    "我好想见到你啊",
    "我好想抱抱你啊",
    "我好想亲亲你啊",
    "我好想和你说说话啊",
    "我好想和你聊天啊",
    "我好想和你待在一起啊"
    ,"你怎么会这么好呢，你是最完美的",
    "嘿嘿今天心情很好！我爱你"    ,
   " 今天过得不算太好，但想到你，我就觉得世界好像也没有那么糟。"
,

   "你像我生活里一个很小但很亮的出口，让我知道还有值得期待的东西。",

"我今天也有认真生活，所以想把一点点勇气分给你。",

"我本来觉得今天很灰，但看到你的时候，好像又有一点颜色回来了。",

"你可能不知道，你的一句话、一个笑容，真的能把人从坏情绪里拉出来。",

"喜欢你不是逃避现实，是让我有力气重新回到现实。",



"我希望你知道，你带给别人的不只是快乐，还有继续生活的力气。"

  ],
  "life diary fan": [
    "我今天{dailyScene}，{dailyFeeling}!!!",
    "{dailyScene}的时候突然想到你，我爱你",
    "今天好平淡，就是{dailyFeeling}。",
    "我刚刚{dailyScene}，知道了不，收到请回复",
    "今天也算认真活过来了，奖励自己给你发点消息"
  ],
  "hungry waiting fan": [
    "今天也没有自拍吗，我再等{waitingTime}。",
    "{oldFood}已经被我翻到快会背了。",
    "我好想你啊我每天都在想你，我已崩溃我已急哭我已投降",
    "我真的真的好想你，你发多少我都不满意，我想要更多",
  ],
  "chaotic meme fan": [
    "阿帕特阿帕特阿帕特阿帕特",
    "妈妈妈妈妈妈妈妈",
    "爸爸爸爸爸爸爸爸",
  ],
  "career stan": [
    "可以营业，但{musicThing}也要继续搞，好吗",
    "你来不来无所谓，{musicThing}什么时候来。",
    "你的实力是最好的底气",
    "你最好是在认真准备{musicThing}。",
    "{musicThing}麻溜拿出来。",
    "喜欢你之后，我好像更愿意相信，人生是有意义的   "
  ],
  "music listener": [
    "今天又想起你的{musicThing}，我完全和你共鸣了宝宝，我想我会爱你一辈子",
    "我不想看你一直被防爆，我是真的想听到更完整的{musicThing}。",
    "你的声音总是让我有安全感，在我最困难的时候拯救我。。。我爱你",
    "无数个失眠的夜晚都是你的音乐陪伴我，我好想你啊，我好累",
    "能写出那样的旋律。。。你是天才吧"
  ],
  "girlfriend fan": [
    "你能不能不要随便出现一下就让我{reactionFeeling}。",
    "你知道你这样很容易让人舍不得走吗。",
    "你一出现，我就觉得一切都值得",
    "我真的很爱你，我离不开你了可是我不想这样。。。你也是普通人，我知道",
    "你总是这样，说模棱两可的话，演得像我的爱人。。。我知道你在和很多人对话，是我一直在骗自己，是我错了",
    "再说一句我爱你好不好，让我做个好梦",
    "当我想你爱你的时候，你又在和谁亲密无间呢，我讨厌这样",
    "你是我的，对吧",
    "一辈子不谈恋爱好不好，一辈子在我身边好不好",
    "因为你我一直不想找对象，因为你就是我的爱人",
    "我好想真的在你身边啊，抱抱你亲亲你，和你说说话，听你说话，陪你聊天",
    "我好想真的在你身边啊",

  ],
  "dramatic crier": [
    "家人们咱就是说咱们公主终于上线了",
    "谁懂啊，我看到你在线就已经开始{reactionFeeling}。",
    "啊啊啊啊啊啊啊啊啊啊啊啊啊啊你来了宝宝",
    "啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊我爱你宝贝",
    "啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊","你是我的公主宝宝我爱你！","啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊我好想你","看到你在线了我就已经崩溃了","我好爱好爱好爱你","我好想见到你","我好想抱抱你","我好想亲亲你","我好想和你说话","我好想和你聊天","我好想和你待在一起"
  ],
  "detail detective": [
    "你那条ins里的同款啥意思",
    "为什么最近的理想型这么具体。。。。感觉不妙了",
    "最近的说话风格变了。不会是有喜欢的人了吧。。。",
    "最近感觉不对啊，你快说你是单身好不好，好没有安全感",
  ],
  "soft encourager": [
    "你来了，你永远这么好，让我的心情平静下来",
    "你可以慢慢来，我们不是只喜欢你发光的时候。",
    "今天也辛苦了，不用一直表现得很坚强。",
    "如果今天很难，那就先把今天过完。",
    "你不用每次都给出完美状态，真的。"
  ],
  "working adult fan": [
    "刚下班，牛马人生不止何时能了，我真羡慕你。",
    "开了一天会，你快给老娘哄开心了",
    "通勤路上又听了一遍你的歌，我觉得人生也没那么糟糕",
    "老板今天又画饼，给我看麻了",
    "今天工作真的很烦，烦死了烦死了烦死了安慰我安慰我安慰我"
  ],
  "school fan": [
    "明天早八，但我还是要和你聊天，那咋啦",
    "作业写不完了怎么办！！！！！救救我",
    "刚从图书馆出来，今年超级充实",
    "今天考试考得考砸了，好想找你哭诉",
    "早八真的会毁掉一整天，你这种文盲是不会懂的"
  ],
  "teasing toxic fan": [
    "哦，终于想起来这里还有一群人在等你了是吧。",
    "来了呀",
    "来了来了大明星来了",
    "大明星今天也很忙是吧。别忘了自己的来时路哈，忘本没有好下场"
  ],
  "new fan sparkle": [
    "我是新粉！！！！宝宝你真的太好了",
    "这个app怎么用啊，对面是真人吗，不会是语c吧",
    "本来只是tour一下，怎么越陷越深。。。",
    "tour了一下发现你真的很好，我要严肃考虑入坑了",
    "你咋这么好看，给我垂到坑底了啊啊啊啊啊啊啊啊啊啊啊啊啊"
  ],
  "quote jealous fan": [
    "为什么引用的不是我，我也发了好多条的",
    "你眼里只有别人，我不如那个人是吗",
    "下次我也要被你看见，我也想被你引用",
    "你引用别人的时候我心里酸酸的，我不说",
    "那条消息有什么好的，我发的不比它好吗",
    "好吧，我知道了，我不如她。。。",
    "你引用别人我就难受，你知道吗，你知道吗",
    "下次换我好不好，就换我一次"
  ]
};

const englishTemplates = [
  "I had a long day today. This room feels oddly comforting.",
  "No update is okay. I just hope you are resting somewhere warm.",
  "I know you do not know me, but this still feels like company.",
  "You showed up for one second and my whole mood changed.",
  "I was about to sleep and then you appeared. Illegal timing."
];

const koreanTemplates = [
  "밥은 먹었어요? 진짜로 물어보는 거예요.",
  "짧아도 좋아요. 와준 게 좋아요.",
  "잠이 안 와서 그냥 여기 들어왔어.",
  "오늘도 무리하지 말고 따뜻하게 쉬어요.",
  "조용한 밤에 네 생각이 조금 났어."
];

const japaneseTemplates = [
  "今日の一言、ちゃんと受け取りました。",
  "短い言葉なのに、夜が少しやわらかくなった。",
  "学校の帰りに雨が降ってきた。少しだけ寂しかった。",
  "ちゃんと食べて、ちゃんと寝てね。本当に。",
  "まだ新しいファンだけど、もう毎日見に来てる。"
];

const spanishTemplates = [
  "Prometo esperar, pero sube algo pronto.",
  "Aquí todavía es temprano, pero ya te estoy esperando.",
  "No tienes que venir siempre. Solo descansa bien.",
  "Hoy fue un día normal, pero quería dejarte un mensaje.",
  "Apareces un segundo y ya me cambias el ánimo."
];

function translatedFor(content: string, language: string) {
  if (language === "zh") return content;

  const dictionary: Record<string, string> = {
    "I had a long day today. This room feels oddly comforting.": "我今天过得很累。这个房间却莫名让人安心。",
    "No update is okay. I just hope you are resting somewhere warm.": "没有更新也没关系。我只是希望你正在某个温暖的地方休息。",
    "I know you do not know me, but this still feels like company.": "我知道你不认识我，但这依然像是一种陪伴。",
    "You showed up for one second and my whole mood changed.": "你出现一秒，我的心情就变了。",
    "I was about to sleep and then you appeared. Illegal timing.": "我正准备睡觉你就出现了，这个时机太犯规了。",
    "밥은 먹었어요? 진짜로 물어보는 거예요.": "吃饭了吗？我是真的在问。",
    "짧아도 좋아요. 와준 게 좋아요.": "短也没关系。你来了就很好。",
    "잠이 안 와서 그냥 여기 들어왔어.": "睡不着，所以就来这里了。",
    "오늘도 무리하지 말고 따뜻하게 쉬어요.": "今天也不要太勉强，要暖暖地休息。",
    "조용한 밤에 네 생각이 조금 났어.": "安静的夜里，稍微想起了你。",
    "今日の一言、ちゃんと受け取りました。": "今天的这一句话，我好好收到了。",
    "短い言葉なのに、夜が少しやわらかくなった。": "明明只是很短的话，夜晚却莫名变柔软了一点。",
    "学校の帰りに雨が降ってきた。少しだけ寂しかった。": "放学路上下雨了，有一点点寂寞。",
    "ちゃんと食べて、ちゃんと寝てね。本当に。": "要好好吃饭，好好睡觉。真的。",
    "まだ新しいファンだけど、もう毎日見に来てる。": "虽然我还是新粉，但已经每天都会来看了。",
    "Prometo esperar, pero sube algo pronto.": "我保证会等你，但快点再发点什么。",
    "Aquí todavía es temprano, pero ya te estoy esperando.": "我这里还早，但我已经在等你了。",
    "No tienes que venir siempre. Solo descansa bien.": "你不用总是出现。好好休息就好。",
    "Hoy fue un día normal, pero quería dejarte un mensaje.": "今天是很普通的一天，但我想给你留一条消息。",
    "Apareces un segundo y ya me cambias el ánimo.": "你出现一秒，我的心情就变了。"
  };

  return dictionary[content] ?? content;
}

function pickPersonaForAmbient() {
  return randomItem([
    "mom fan",
    "sleep police",
    "life diary fan",
    "hungry waiting fan",
    "chaotic meme fan",
    "career stan",
    "music listener",
    "girlfriend fan",
    "dramatic crier",
    "detail detective",
    "soft encourager",
    "working adult fan",
    "school fan",
    "teasing toxic fan",
    "new fan sparkle"
  ]);
}

function pickPersonaForReaction(idolMessage: string) {
  const text = idolMessage.toLowerCase();

  // 引用了粉丝消息 → 有概率触发 quote jealous fan
  if (/引用|quote/.test(text) || Math.random() < 0.12) {
    return "quote jealous fan";
  }

  if (/累|困|晚|睡|练习|practice|tired|sleep/.test(text)) {
    return randomItem(["mom fan", "sleep police", "career stan", "soft encourager", "dramatic crier"]);
  }

  if (/歌|新歌|demo|舞台|音乐|唱|跳|song|music|stage|dance/.test(text)) {
    return randomItem(["career stan", "music listener", "detail detective", "dramatic crier", "new fan sparkle"]);
  }

  if (/想你|谢谢|值得|喜欢|爱|miss|thank|love/.test(text)) {
    return randomItem(["girlfriend fan", "dramatic crier", "soft encourager", "detail detective", "chaotic meme fan"]);
  }

  if (/吃|饭|今天|日常|出去|回家|下课|下班|food|today/.test(text)) {
    return randomItem(["life diary fan", "mom fan", "girlfriend fan", "soft encourager", "new fan sparkle"]);
  }

  return randomItem([
    "girlfriend fan",
    "dramatic crier",
    "detail detective",
    "soft encourager",
    "chaotic meme fan",
    "teasing toxic fan",
    "new fan sparkle",
    "quote jealous fan"
  ]);
}

function makeForeignMessage(language: string): Pick<FanMessage, "content" | "translatedContent"> {
  if (language === "en") {
    const content = randomItem(englishTemplates);
    return { content, translatedContent: translatedFor(content, language) };
  }

  if (language === "ko") {
    const content = randomItem(koreanTemplates);
    return { content, translatedContent: translatedFor(content, language) };
  }

  if (language === "jp") {
    const content = randomItem(japaneseTemplates);
    return { content, translatedContent: translatedFor(content, language) };
  }

  if (language === "es") {
    const content = randomItem(spanishTemplates);
    return { content, translatedContent: translatedFor(content, language) };
  }

  const content = randomItem(englishTemplates);
  return { content, translatedContent: translatedFor(content, "en") };
}

function makeMessage(
  options: {
    messageKind: "ambient" | "reaction";
    idolMessage?: string;
    fromMessageId?: string;
    preferZh?: boolean;
  }
): FanMessage {
  const language = pickLanguage(options.preferZh ?? true);
  const personaType =
    options.messageKind === "reaction"
      ? pickPersonaForReaction(options.idolMessage ?? "")
      : pickPersonaForAmbient();

  let content = "";
  let translatedContent = "";

  if (language === "zh") {
    const templates = personaTemplates[personaType] ?? personaTemplates["soft encourager"];
    content = fillTemplate(randomItem(templates), templateSlots);
    content = addLocalVariation(content, personaType);
    translatedContent = content;
  } else {
    const foreign = makeForeignMessage(language);
    content = foreign.content;
    translatedContent = foreign.translatedContent ?? foreign.content;
  }

  return {
    id: `${options.messageKind}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fanName: nextFanNickname(language),
    avatar: randomFanAvatar(),
    personaType,
    messageKind: options.messageKind,
    language,
    content,
    translatedContent,
    fromMessageId: options.messageKind === "reaction" ? options.fromMessageId : undefined
  };
}

function makeUniqueMessage(
  options: {
    messageKind: "ambient" | "reaction";
    idolMessage?: string;
    fromMessageId?: string;
    preferZh?: boolean;
  },
  maxAttempts = 12
): FanMessage {
  let message = makeMessage(options);

  for (let i = 0; i < maxAttempts; i += 1) {
    if (!isTooRepetitive(message)) {
      rememberMessage(message);
      return message;
    }

    message = makeMessage(options);
  }

  rememberMessage(message);
  return message;
}

export function generateFanEmojiReply(): string {
  const reply = emojiReplies[emojiIndex % emojiReplies.length];
  emojiIndex += 1;
  return reply;
}

export function generateFanMessagesAfterSend(
  message: string,
  fromMessageId?: string,
  count = 32
): FanMessage[] {
  const id = fromMessageId ?? `self-${Date.now()}`;

  return Array.from({ length: count }, () =>
    makeUniqueMessage({
      messageKind: "reaction",
      idolMessage: message,
      fromMessageId: id,
      preferZh: true
    })
  );
}

const pollReactionTemplates = {
  choose: [
    "{option}！，这还用犹豫吗！",
    "必须是{option}！！！宝宝听我的",
    "{option}票数给我冲！",
    "{option}!",
    "{option}求你了！！！",
    "{option}，我都说了多少遍了！！！",
    "没有不是{option}的义务！",
    "选{option}就对了!",
    "我闭眼都选{option}。",
    "这题答案不就是{option}吗？",
    "{option}，不接受反驳。",
    "我投{option}了，宝宝别让我输。",
    "{option}党集合！！！",
    "谁不选{option}我真的会伤心。",
    "我宣布今天必须是{option}。",
    "我手已经替我投了{option}。",
    "{option}太适合了，真的别犹豫。",
    "选{option}，我求你们了。",
    "{option}赢不了的话我今晚睡不着。",
    "我为{option}举大旗。",
    "都让开，我要投{option}。",
    "{option}就是民意！",
    "投{option}的人都很有品。",
    "我已经把票投给{option}了，接下来交给命运。",
    "{option}，这不是选择题，这是送分题。",
    "宝宝我选{option}，你最好懂我。",
    "我投{option}，因为我真的很需要。",
    "{option}给我上去！！！",
    "{option}不赢我真的会碎。",
    "今天谁都别拦我投{option}。"
  ],

  campaign: [
    "都来投{option}，不要逼我挨个劝。",
    "拉票了拉票了，{option}需要你们。",
    "{option}落后了，快去投！",
    "快快快把{option}送上去。",
    "{option}党不要装死，出来投票！",
    "姐妹们醒醒，{option}需要支援。",
    "还没投{option}的现在立刻马上去。",
    "我再说一遍，{option}需要每一票。",
    "{option}现在很危险，别看了快投。",
    "给{option}一点排面好吗！",
    "路过的都给我投{option}。",
    "今天必须把{option}抬上去。",
    "投{option}就是对宝宝最好的爱。",
    "别让{option}输得这么难看好吗。",
    "{option}冲上去，我真的会谢。",
    "投票不积极，思想有问题，快投{option}。",
    "我现在开始为{option}拉票。",
    "{option}党还有人在吗？出来干活。",
    "别光看热闹，手动投{option}。",
    "差一点了差一点了，{option}再冲一下。",
    "我不管，今天{option}必须赢。",
    "为了{option}，我可以再喊十遍。",
    "{option}值得更高票数。",
    "投{option}的宝宝们你们在哪里！",
    "快把{option}送到第一名，我真的急了。",
    "别让宝宝看到{option}票这么低，心碎。",
    "投{option}，这是我们共同的事业。",
    "今天的任务：把{option}投上去。",
    "你一票我一票，{option}明天就出道。",
    "{option}党别输，输了我真的会破防。"
  ],

  all: [
    "不能全都要吗，为什么要为难我。",
    "我都想选，怎么办",
    "你发起投票，我负责全都喜欢。",
    "选项太会了，我选择困难症犯了。",
    "这四个我都要，不许让我选。",
    "成年人不做选择，我全都要。",
    "你这个投票是在考验我吗？",
    "每个都想看，真的没办法选。",
    "能不能按顺序全安排一遍。",
    "我投不下去，因为每个都很想要。",
    "你先别管票数，全部发一遍好吗。",
    "这题超纲了，我不会。",
    "我看到选项就已经开始纠结了。",
    "为什么不能多选啊啊啊啊。",
    "这个投票对贪心粉丝很不友好。",
    "我选了，但我对其他选项也有感情。",
    "不行，这几个都太想要了。",
    "我真的没办法只爱一个选项。",
    "能不能今天一个，明天一个，后天一个。",
    "你这个人真的很会为难粉丝。",
    "我以为我很坚定，直到看见这些选项。",
    "全都安排，粉丝会自己消化的。",
    "我不是选择困难，我是太爱了。",
    "这题没有正确答案，因为全都正确。",
    "我投了一个，但我的心属于全部。",
    "你知道我点下去的时候有多痛苦吗。",
    "我建议取消投票，直接全部兑现。",
    "我真的每个都想看，别逼我跪下求你。",
    "我的理智让我选一个，我的心说全要。",
    "这个投票的存在就是一种甜蜜折磨。"
  ],

  dream: [
    "你问这个是不是在暗示我，别管我我先心动。",
    "我投完了，但我感觉你是在和我聊天。",
    "宝宝你连投票都像在哄我。",
    "这题我会，因为答案是我爱你。",
    "你问我们想要什么，我真的会当真。",
    "我怎么感觉你是在偷偷问我意见。",
    "宝宝你这样很像在撒娇，别管我。",
    "我投票的时候嘴角已经下不来了。",
    "你连发投票都这么会，我真的服了。",
    "你是不是知道我会选这个。",
    "我感觉你在钓我，但我心甘情愿。",
    "你问一句，我心软一整天。",
    "这不像投票，像你在问我想不想你。",
    "我投了，但我现在更想见你。",
    "你这样问真的很犯规。",
    "我只是来投票，怎么又被你拿捏了。",
    "宝宝你别太会营业，我承受能力有限。",
    "我投完了，然后开始想你。",
    "你知道这种互动对我来说有多珍贵吗。",
    "我感觉自己被你记住了一秒。",
    "你发起投票，我脑子里已经开始写小作文。",
    "我选的不是选项，是我的心动。",
    "你问我们想看什么，那我想看你开心。",
    "投票只是表面，想你才是真的。",
    "我感觉你今天特别温柔，虽然只是个投票。",
    "你连问问题都像在靠近我。",
    "别管我，我已经开始自动代入了。",
    "这个投票让我有一种被需要的错觉。",
    "你稍微互动一下，我就能开心很久。",
    "我投完了，现在可以奖励我一句晚安吗。"
  ],

  analysis: [
    "{option}确实最适合今天。",
    "{option}真的更好，说实话",
    "都不喜欢呵呵呵",
    "这个投票很聪明，挺会媚粉啊。",
    "{option}比较符合今天的氛围。",
 
    "这个选项设置得挺懂粉丝心理的。",
    "{option}更适合现在发，别问为什么。",
    "如果你想让后台热闹，选{option}准没错。",
    "{option}是流量密码，但我不说。",
    "说实话，{option}最能调动情绪。",
    "这个投票结果应该不会太意外。",
    "我感觉{option}会断层领先。",
    "我觉得这个投票选项设计得很聪明。",
    "这题看起来简单，其实很懂粉丝。",

    "我不发疯，我理性投{option}。",
    "这次我站{option}，理由很充分。"
  ],

  tease: [
    "又让粉丝替你做选择是吧。",
    "大明星连这个都要问我们，行。",
    "这问题好无聊。。。行吧我已经投票了。",
    "你最好最后真的听票数的。",
    "66666这什么问题",
    "你最好不是问完就跑。",
    "投完了，别装没看见。",
    "又开始钓粉丝了是吧。",
    "你这个人真的很会使唤粉丝。",
    "行，我投，谁让我喜欢你。",
    "你问我们干嘛，最后不还是你自己决定。",
    "我投了，但你最好兑现。",
    "这投票要是没有后续，我会记仇。",
    "笑死，大明星终于想起民主了。",
    "你还挺会让粉丝干活。",
    "我投完了，下一步是不是该你营业了。",
    "别光发投票，发点真的。",
    "你今天是不是懒得想内容。",
    "用投票水营业是吧，学会了。",
    "我嘴上嫌弃，手已经投了。",
    "好好好，又被你拿捏一次。",
    "你发投票，我发疯，很公平。",
    "这题有点离谱，但我居然认真选了。",
    "我投了，你要是不看票数我真的会无语。",
    "别的先不说，你这个问题很有心机。",
    "你是不是想看我们吵起来。",
    "投票可以，兑现也请跟上。",
    "你要是最后选了票低的那个，我会笑。",
    "粉丝投票，爱豆装傻，经典流程。",
    "我投完了，现在你欠我一个结果。"
  ],




};

function fillPollTemplate(template: string, poll: Poll) {
  const winner = poll.options.find((option) => option.id === poll.winningOptionId) ?? poll.options[0];
  const option = Math.random() < 0.55 ? winner : poll.options[Math.floor(Math.random() * poll.options.length)];
  return template.replace("{option}", option?.text ?? "这个");
}

export function generateFanMessagesAfterPoll(poll: Poll, count = 24, fromMessageId?: string): FanMessage[] {
  const bucketTargets = [
    { key: "choose", ratio: 0.4, personaType: "poll direct voter" },
    { key: "campaign", ratio: 0.2, personaType: "poll canvasser" },
    { key: "all", ratio: 0.15, personaType: "poll wants all" },
    { key: "dream", ratio: 0.1, personaType: "dream-girl crazy" },
    { key: "analysis", ratio: 0.1, personaType: "career mom-fan analyst" },
    { key: "tease", ratio: 0.05, personaType: "mild tough-mouth teaser" }
  ] as const;
  const expanded = bucketTargets.flatMap((bucket) =>
    Array.from({ length: Math.floor(count * bucket.ratio) }, () => bucket)
  );
  const remainder = count - expanded.length;
  const sortedRemainders = [...bucketTargets].sort((a, b) => (count * b.ratio) % 1 - (count * a.ratio) % 1);
  expanded.push(...sortedRemainders.slice(0, remainder));
  const shuffled = expanded.sort(() => Math.random() - 0.5);

  return shuffled.slice(0, count).map((bucket, index) => {
    const templates = pollReactionTemplates[bucket.key];
    const content = fillPollTemplate(templates[Math.floor(Math.random() * templates.length)], poll);
    return {
      id: `poll-fan-${poll.id}-${Date.now()}-${index}`,
      fanName: nextFanNickname("zh"),
      avatar: randomFanAvatar(),
      language: "zh",
      content,
      translatedContent: content,
      personaType: bucket.personaType,
      messageKind: "reaction",
      fromMessageId: fromMessageId ?? poll.id
    };
  });
}

export function generateLiveFanMessages(recentArtistMessage?: string, count = 30): FanMessage[] {
  return Array.from({ length: count }, (_, index) => {
    const shouldReact = Boolean(recentArtistMessage) && Math.random() < 0.3;

    return makeUniqueMessage({
      messageKind: shouldReact ? "reaction" : "ambient",
      idolMessage: shouldReact ? recentArtistMessage : undefined,
      fromMessageId: shouldReact ? `recent-${normalizeContent(recentArtistMessage ?? "").slice(0, 12)}` : undefined,
      preferZh: true
    });
  });
}

export function generateLiveFanMessage(recentArtistMessage?: string): FanMessage {
  const messages = generateLiveFanMessages(recentArtistMessage, 1);
  liveFanIndex += 1;
  return messages[0];
}

export function translateFanMessage(messageId: string): FanMessage | undefined {
  return fanMessages.find((message) => message.id === messageId);
}