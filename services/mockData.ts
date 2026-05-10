import { Artist, ChatMessage, FanMessage, IdolChatThread, Profile } from "@/types/idol";

export const myProfile: Profile = {
  id: "me",
  nickname: "Luna Field",
  signature: "Tonight I am practicing how to shine softly.",
  email: "luna.field@example.com",
  avatar: "LF"
};

export const recommendedArtists: Artist[] = [
  {
    id: "artist-1",
    nickname: "Mira Vale",
    avatar: "MV",
    background: "#EADDF8",
    bio: "A dreamy solo artist who sends late-night voice-note energy.",
    signature: "Tiny moon, big stage.",
    identity: "Solo Artist",
    fans: "82.4K",
    intro: "Mira writes warm synth-pop and leaves tiny notes for fans after rehearsal."
  },
  {
    id: "artist-2",
    nickname: "Nova Rin",
    avatar: "NR",
    background: "#DCEEFF",
    bio: "Virtual idol with a soft glitch heart and cosmic dance breaks.",
    signature: "Signal found. Heart online.",
    identity: "Virtual Idol",
    fans: "146K",
    intro: "Nova appears in digital stages and treats every chat like a secret constellation."
  },
  {
    id: "artist-3",
    nickname: "Eden Skye",
    avatar: "ES",
    background: "#F3D7E5",
    bio: "Band vocal with gentle chaos, coffee lyrics, and sunrise rehearsals.",
    signature: "Still singing, still here.",
    identity: "Band Vocal",
    fans: "57.9K",
    intro: "Eden is the main vocal of a fictional indie band and loves sending rehearsal diary messages."
  },
  {
    id: "artist-4",
    nickname: "Sora Bloom",
    avatar: "SB",
    background: "#E3F4E8",
    bio: "Soft-spoken dance performer who collects little fan wishes.",
    signature: "One more step toward you.",
    identity: "Dance Artist",
    fans: "39.1K",
    intro: "Sora shares small behind-the-scenes moments, sleepy updates, and practice-room courage."
  }
];

export const addedArtists: Artist[] = [recommendedArtists[0]];

export const selfChatMessages: ChatMessage[] = [
  {
    id: "self-1",
    sender: "self",
    text: "Practice ended late, but I saw the moon from the studio window. It felt like a tiny encore.",
    status: "sent",
    createdAt: "22:18"
  },
  {
    id: "fan-emoji-1",
    sender: "fan",
    text: "💜🥹✨",
    createdAt: "22:19"
  }
];

export const idolChatMessages: IdolChatThread[] = [
  {
    artistId: "artist-1",
    messages: [
      {
        id: "mira-1",
        sender: "artist",
        text: "I saved one tiny lyric from rehearsal today. Maybe it will become yours soon.",
        createdAt: "21:02"
      },
      {
        id: "mira-2",
        sender: "artist",
        text: "Drink water for me, okay? I forgot until the choreographer stared at my bottle.",
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
        text: "System note: I missed you by 0.003 seconds today.",
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
        text: "My throat is tired, but my heart is noisy. Thank you for listening from wherever you are.",
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
        text: "I finally landed the turn. It looked quiet, but inside I was fireworks.",
        createdAt: "19:47"
      }
    ]
  }
];

export const fanMessages: FanMessage[] = [
  {
    id: "fan-1",
    fanName: "小雨",
    avatar: "🐰",
    language: "zh",
    content: "你今天也辛苦了，看到你发消息我就放心一点。",
    translatedContent: "你今天也辛苦了，看到你发消息我就放心一点。"
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
    content: "又只发一句？好吧，一句也够我循环看十遍。",
    translatedContent: "又只发一句？好吧，一句也够我循环看十遍。"
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
  "怎么还不营业", "今天又失踪了", "你还知道回来", "营业很难吗", "少装神秘", "你最好有事",
  "今天必须营业", "营业欠费了吗", "又装消失是吧", "你是不是忘了我们", "搞事业好吗",
  "作品呢作品呢", "专辑什么时候发", "舞台在哪里", "事业批真的会急", "你能不能争气点",
  "数据女工已崩溃", "榜单保安发怒", "音源巡逻员", "回归倒计时bot", "今天练声了吗",
  "你最好在写歌", "少营业多练习", "别逼我催你", "事业心在哪里", "舞台粉很着急",
  "作品粉想报警", "恋爱禁止bot", "恋爱达咩", "房塌观察员", "塌房预警机",
  "事业上升期别恋爱", "恋爱脑退散", "单身证明交一下"
];
let emojiIndex = 0;
let liveFanIndex = 0;

function randomFanAvatar() {
  return fanAvatarPool[Math.floor(Math.random() * fanAvatarPool.length)];
}

function nextFanNickname() {
  const random = Math.random();
  let pool = normalFanNicknamePool;
  if (random > 0.9) {
    pool = toxicFanNicknamePool;
  } else if (random > 0.68) {
    pool = chaoticFanNicknamePool;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

const liveFanMessagePool: Omit<FanMessage, "id">[] = [
  {
    fanName: "Riri",
    avatar: "🐰",
    personaType: "hype captain",
    messageKind: "ambient",
    language: "en",
    content: "I was about to sleep and then you appeared. Illegal timing.",
    translatedContent: "我正准备睡觉你就出现了，这个时机太犯规了。"
  },
  {
    fanName: "柚子冰",
    avatar: "🐱",
    personaType: "detail detective",
    messageKind: "ambient",
    language: "zh",
    content: "已读十遍，准备开始第十一遍。",
    translatedContent: "已读十遍，准备开始第十一遍。"
  },
  {
    fanName: "나비",
    avatar: "🐶",
    personaType: "comfort guardian",
    messageKind: "ambient",
    language: "ko",
    content: "밥은 먹었어요? 진짜로 물어보는 거예요.",
    translatedContent: "吃饭了吗？我是真的在问。"
  },
  {
    fanName: "そら",
    avatar: "🐼",
    personaType: "soft encourager",
    messageKind: "ambient",
    language: "jp",
    content: "今日の一言、ちゃんと受け取りました。",
    translatedContent: "今天的这一句话，我好好收到了。"
  },
  {
    fanName: "Cata",
    avatar: "🦊",
    personaType: "waiting-room fan",
    messageKind: "ambient",
    language: "es",
    content: "Prometo esperar, pero sube algo pronto.",
    translatedContent: "我保证会等你，但快点再发点什么。"
  },
  {
    fanName: "奶油卷",
    avatar: "🐻",
    personaType: "sleep police",
    messageKind: "ambient",
    language: "zh",
    content: "别硬撑啦，营业可以短，休息不能少。",
    translatedContent: "别硬撑啦，营业可以短，休息不能少。"
  },
  {
    fanName: "Jae",
    avatar: "🐹",
    personaType: "new fan sparkle",
    messageKind: "ambient",
    language: "en",
    content: "This message just fixed my whole commute.",
    translatedContent: "这条消息直接拯救了我的通勤路。"
  },
  {
    fanName: "하루",
    avatar: "🐨",
    personaType: "emoji minimalist",
    messageKind: "ambient",
    language: "ko",
    content: "짧아도 좋아요. 와준 게 좋아요.",
    translatedContent: "短也没关系。你来了就很好。"
  }
];

const reactionFanMessagePool: Omit<FanMessage, "id">[] = [
  {
    fanName: "晚星",
    avatar: "🐯",
    personaType: "dramatic crier",
    messageKind: "reaction",
    language: "zh",
    content: "你刚才那句真的让我眼泪一下就上来了。",
    translatedContent: "你刚才那句真的让我眼泪一下就上来了。"
  },
  {
    fanName: "Mika",
    avatar: "🦁",
    personaType: "hype captain",
    messageKind: "reaction",
    language: "en",
    content: "That update just turned my whole night around.",
    translatedContent: "你刚才那条消息直接让我的夜晚变好了。"
  },
  {
    fanName: "半糖",
    avatar: "🐸",
    personaType: "teasing old fan",
    messageKind: "reaction",
    language: "zh",
    content: "刚才那句太短了，罚你下次多说一点。",
    translatedContent: "刚才那句太短了，罚你下次多说一点。"
  },
  {
    fanName: "별밤",
    avatar: "🐧",
    personaType: "comfort guardian",
    messageKind: "reaction",
    language: "ko",
    content: "그 말 들으니까 더 쉬었으면 좋겠어요.",
    translatedContent: "听到那句话之后，更希望你好好休息。"
  },
  {
    fanName: "Luz",
    avatar: "🦄",
    personaType: "long-distance fan",
    messageKind: "reaction",
    language: "es",
    content: "Ese mensaje llegó hasta mi zona horaria.",
    translatedContent: "那条消息传到了我的时区。"
  }
];

export function generateFanEmojiReply(): string {
  const reply = emojiReplies[emojiIndex % emojiReplies.length];
  emojiIndex += 1;
  return reply;
}

export function generateFanMessagesAfterSend(message: string): FanMessage[] {
  const stamp = Date.now();
  return [
    {
      id: `generated-${stamp}-1`,
      fanName: nextFanNickname(),
      avatar: randomFanAvatar(),
      personaType: "protective big sibling",
      language: "en",
      content: "That line felt like a tiny blanket. Please rest too.",
      translatedContent: "那句话像一条小毯子。你也要休息。",
      fromMessageId: message
    },
    {
      id: `generated-${stamp}-2`,
      fanName: nextFanNickname(),
      avatar: randomFanAvatar(),
      personaType: "teasing old fan",
      language: "zh",
      content: "营业检查通过，但下次能不能多打两个字。",
      translatedContent: "营业检查通过，但下次能不能多打两个字。",
      fromMessageId: message
    },
    {
      id: `generated-${stamp}-3`,
      fanName: nextFanNickname(),
      avatar: randomFanAvatar(),
      personaType: "comfort guardian",
      language: "ko",
      content: "무리하지 말고 따뜻하게 있어요.",
      translatedContent: "别勉强自己，要暖暖地待着。主语是你。",
      fromMessageId: message
    },
    {
      id: `generated-${stamp}-4`,
      fanName: nextFanNickname(),
      avatar: randomFanAvatar(),
      personaType: "update chaser",
      language: "es",
      content: "Ya estoy esperando el próximo mensaje.",
      translatedContent: "我已经在等下一条消息了。"
    }
  ];
}

export function generateLiveFanMessage(recentArtistMessage?: string): FanMessage {
  const shouldReact = Boolean(recentArtistMessage) && liveFanIndex % 3 === 1;
  const pool = shouldReact ? reactionFanMessagePool : liveFanMessagePool;
  const base = pool[liveFanIndex % pool.length];
  liveFanIndex += 1;
  return {
    ...base,
    fanName: nextFanNickname(),
    avatar: randomFanAvatar(),
    fromMessageId: shouldReact ? recentArtistMessage : undefined,
    id: `live-${Date.now()}-${liveFanIndex}`
  };
}

export function translateFanMessage(messageId: string): FanMessage | undefined {
  return fanMessages.find((message) => message.id === messageId);
}
