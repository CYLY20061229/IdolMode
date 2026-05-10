/**
 * seed-history.mjs
 * 向 history_messages 表批量写入模板消息，用于 burst 效果的历史消息池。
 *
 * 用法：
 *   node server/scripts/seed-history.mjs
 *   node server/scripts/seed-history.mjs --dry-run   # 只打印，不写库
 *   node server/scripts/seed-history.mjs --clear     # 先清空再写入
 *
 * 环境变量：
 *   DATABASE_URL  PostgreSQL 连接串（必须）
 *   PORT          可选，不影响本脚本
 */

import { createHash } from "node:crypto";
import { loadEnvFiles } from "../src/env.mjs";

loadEnvFiles();

import { query, closePool } from "../src/db.mjs";

// ─── 配置 ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const CLEAR   = process.argv.includes("--clear");
const BATCH_SIZE = 50; // 每次 INSERT 的行数

// ─── 数据池 ──────────────────────────────────────────────────────────────────

const animalAvatars = [
  "🐰","🐱","🐶","🐼","🦊","🐻","🐹","🐨","🐯","🦁",
  "🐮","🐸","🐵","🐧","🐥","🦄","🐺","🐙","🦔","🦦"
];

const languages = ["zh","en","ko","jp","es"];

/** 每种语言的 ambient 模板消息 */
const templates = {
  zh: [
    // 日常陪伴
    "今天也在等你，不急。",
    "看到通知亮起来就开心了。",
    "短短一句也够我撑过今晚。",
    "希望你今天也被温柔对待。",
    "不管多晚，看到你发消息就安心。",
    "今天有点累，但看到你就好了。",
    "你知道吗，你一营业我就复活了。",
    "今天也因为你撑过去了，谢谢。",
    "不用说什么，看到你在就够了。",
    "你一发消息我就从被窝里爬出来了。",
    // 催营业
    "饭呢饭呢，今天有饭吗。",
    "已经等了好久了，能不能多说两句。",
    "你最好在写歌，不然我要生气了。",
    "营业欠费了吗，快来补一下。",
    "今天必须营业，我在等。",
    "再不营业我就要去找你了。",
    "你知道我在等吗，快来。",
    "求你多说两句，就两句。",
    "今天有没有新消息，我在蹲。",
    "等你发消息等到手机没电了。",
    // 关心
    "今天吃饭了吗，记得吃。",
    "天气变了，多穿一件。",
    "别太累了，休息一下。",
    "你睡了吗，早点睡。",
    "今天练习辛苦了，好好休息。",
    "身体要照顾好，比什么都重要。",
    "不要熬夜，明天还要加油。",
    "记得喝水，今天喝了吗。",
    "你有没有好好吃饭，我担心你。",
    "今天天气好，出去走走吧。",
    // 情感
    "谢谢你今天也在。",
    "因为有你，今天好过了很多。",
    "你不知道你对我有多重要。",
    "今天也喜欢你，明天也是。",
    "你是我今天最好的事。",
    "看到你就觉得今天值了。",
    "你让我觉得一切都会好的。",
    "谢谢你存在在这个世界上。",
    "今天也因为你笑了，谢谢。",
    "你真的很特别，你知道吗。",
    // 生活碎碎念
    "今天上课好无聊，想你了。",
    "下班了，第一件事就是来看你。",
    "今天考试考砸了，来找你充电。",
    "通勤路上一直在听你的歌。",
    "今天加班到很晚，但看到你就好了。",
    "图书馆复习中，偷偷来看你一眼。",
    "今天吃了好吃的，想分享给你。",
    "今天天气很好，想到了你。",
    "今天有点难过，但看到你好多了。",
    "今天也是普通的一天，因为你变得不普通。",
    // 深夜
    "睡不着，来看看你有没有发消息。",
    "凌晨了，你睡了吗。",
    "今天终于结束了，来找你说晚安。",
    "深夜了，想你了。",
    "今天的最后一件事是来看你。",
    "夜深了，希望你睡得好。",
    "今晚月亮很好看，想到了你。",
    "睡前来看你一眼，晚安。",
    "今天也结束了，谢谢你陪我。",
    "深夜发消息，只是想说今天也喜欢你。",
  ],
  en: [
    "Still here, still waiting for you.",
    "Saw your notification and my whole day got better.",
    "Just one line from you is enough to get me through tonight.",
    "Hope you were treated gently today.",
    "No matter how late, seeing you post makes me feel okay.",
    "Tired today, but you fixed it.",
    "You posted and I literally came back to life.",
    "Thank you for getting me through today.",
    "Don't need you to say much. Just knowing you're here is enough.",
    "You posted and I climbed out of bed immediately.",
    "Where's the content? I'm waiting.",
    "Been waiting forever. Can you say a little more?",
    "You better be writing songs right now.",
    "You owe us some content. Come pay up.",
    "You have to post today. I'm watching.",
    "If you don't post soon I'm coming to find you.",
    "Do you know I'm waiting? Come on.",
    "Just two more sentences. That's all I ask.",
    "Any new updates today? I'm lurking.",
    "Waited so long my phone died.",
    "Did you eat today? Please eat.",
    "It's getting cold. Wear more layers.",
    "Don't overwork yourself. Rest a little.",
    "Did you sleep? Go to sleep.",
    "Practice was hard today. Rest well.",
    "Take care of your body. That's the most important thing.",
    "Don't stay up late. You have tomorrow too.",
    "Remember to drink water. Did you today?",
    "Are you eating properly? I worry about you.",
    "Nice weather today. Go outside for a bit.",
    "Thank you for being here today.",
    "Because of you, today was so much better.",
    "You don't know how much you mean to me.",
    "I like you today. I'll like you tomorrow too.",
    "You were the best thing about today.",
    "Seeing you made today worth it.",
    "You make me feel like everything will be okay.",
    "Thank you for existing in this world.",
    "I smiled today because of you. Thank you.",
    "You're really special. Do you know that?",
    "Class was so boring today. Missed you.",
    "First thing after work: check if you posted.",
    "Failed my exam today. Came here to recharge.",
    "Listened to your songs the whole commute.",
    "Worked late again, but seeing you helped.",
    "Studying in the library. Sneaking a peek at you.",
    "Ate something good today. Wanted to share it with you.",
    "Nice day today. Thought of you.",
    "Had a rough day, but you made it better.",
    "Ordinary day made extraordinary because of you.",
    "Can't sleep. Checking if you posted anything.",
    "It's past midnight. Are you asleep?",
    "Today is finally over. Came to say goodnight.",
    "Late night. Missing you.",
    "Last thing before bed: checking on you.",
    "Night fell. Hope you sleep well.",
    "The moon looks nice tonight. Thought of you.",
    "One last look before I sleep. Goodnight.",
    "Another day done. Thank you for being with me.",
    "Late night message just to say: I like you today too.",
  ],
  ko: [
    "오늘도 기다리고 있어요, 천천히 와도 돼요.",
    "알림 뜨는 거 보고 하루가 좋아졌어요.",
    "짧은 한 마디도 오늘 밤 버티기엔 충분해요.",
    "오늘도 따뜻하게 대우받았으면 좋겠어요.",
    "아무리 늦어도 올라오면 안심이 돼요.",
    "오늘 좀 힘들었는데 보니까 괜찮아졌어요.",
    "영업하면 진짜 살아나는 것 같아요.",
    "오늘도 덕분에 버텼어요, 고마워요.",
    "아무 말 안 해도 돼요, 있어줘서 충분해요.",
    "올라오자마자 이불 박차고 나왔어요.",
    "밥은 먹었어요? 꼭 챙겨 먹어요.",
    "날씨 바뀌었어요, 따뜻하게 입어요.",
    "너무 무리하지 말고 좀 쉬어요.",
    "잠은 잤어요? 일찍 자요.",
    "오늘 연습 고생했어요, 푹 쉬어요.",
    "몸 잘 챙겨요, 그게 제일 중요해요.",
    "밤새지 말아요, 내일도 있잖아요.",
    "물 마셨어요? 오늘 마셨어요?",
    "밥 잘 먹고 있어요? 걱정돼요.",
    "오늘 날씨 좋아요, 잠깐 나가봐요.",
    "오늘도 있어줘서 고마워요.",
    "덕분에 오늘 훨씬 나았어요.",
    "나한테 얼마나 중요한지 모르죠.",
    "오늘도 좋아해요, 내일도요.",
    "오늘 제일 좋은 일이 당신이에요.",
    "보니까 오늘 살 것 같아요.",
    "다 잘 될 것 같은 기분이에요.",
    "이 세상에 있어줘서 고마워요.",
    "오늘 웃었어요, 덕분에요.",
    "진짜 특별한 사람이에요, 알아요?",
    "수업 너무 지루했어요, 보고 싶었어요.",
    "퇴근하고 제일 먼저 여기 왔어요.",
    "시험 망했어요, 충전하러 왔어요.",
    "출퇴근 내내 노래 들었어요.",
    "야근했는데 보니까 괜찮아졌어요.",
    "도서관에서 공부 중인데 몰래 보러 왔어요.",
    "오늘 맛있는 거 먹었어요, 같이 먹고 싶었어요.",
    "날씨 좋아서 생각났어요.",
    "오늘 좀 힘들었는데 보니까 나아졌어요.",
    "평범한 하루였는데 덕분에 특별해졌어요.",
    "잠이 안 와서 올라온 거 있나 봤어요.",
    "새벽인데 자고 있어요?",
    "오늘 드디어 끝났어요, 잘 자요 하러 왔어요.",
    "새벽에 보고 싶었어요.",
    "자기 전에 마지막으로 보러 왔어요.",
    "밤이 됐어요, 잘 자요.",
    "오늘 달이 예뻐요, 생각났어요.",
    "자기 전에 한 번만 더, 잘 자요.",
    "오늘도 끝났어요, 같이 있어줘서 고마워요.",
    "새벽에 그냥 오늘도 좋아한다고 하고 싶었어요.",
  ],
  jp: [
    "今日も待ってるよ、急がなくていいよ。",
    "通知が来て、一日が明るくなった。",
    "短い一言でも、今夜乗り越えられる。",
    "今日も優しくしてもらえてたらいいな。",
    "どんなに遅くても、投稿見たら安心する。",
    "今日ちょっと疲れてたけど、見たら元気出た。",
    "投稿してくれると本当に生き返る感じ。",
    "今日も乗り越えられたのはあなたのおかげ。",
    "何も言わなくていい、いてくれるだけで十分。",
    "投稿見てすぐ布団から出てきた。",
    "ご飯食べた？ちゃんと食べてね。",
    "寒くなってきたから、暖かくしてね。",
    "無理しないで、少し休んでね。",
    "ちゃんと寝た？早く寝てね。",
    "今日の練習お疲れ様、ゆっくり休んでね。",
    "体を大事にしてね、それが一番大切だから。",
    "夜更かしはダメだよ、明日もあるから。",
    "水飲んだ？今日飲んだ？",
    "ちゃんとご飯食べてる？心配してるよ。",
    "今日いい天気だね、少し外に出てみて。",
    "今日もいてくれてありがとう。",
    "あなたのおかげで今日ずっとよかった。",
    "私にとってどれだけ大切か、わかってないよね。",
    "今日も好きだよ、明日も。",
    "今日一番いいことはあなただった。",
    "見たら今日生きていける気がした。",
    "全部うまくいく気がしてくる。",
    "この世界にいてくれてありがとう。",
    "今日笑えたのはあなたのおかげ。",
    "本当に特別な人だよ、わかってる？",
    "授業つまらなかった、会いたかった。",
    "仕事終わって最初にここに来た。",
    "試験失敗した、充電しに来た。",
    "通勤中ずっと曲聴いてた。",
    "残業したけど、見たら大丈夫になった。",
    "図書館で勉強中、こっそり見に来た。",
    "今日おいしいもの食べた、一緒に食べたかった。",
    "いい天気で、あなたのこと思い出した。",
    "今日ちょっとつらかったけど、見たらよくなった。",
    "普通の一日だったけど、あなたのおかげで特別になった。",
    "眠れなくて、何か投稿してないか見に来た。",
    "深夜だけど、寝てる？",
    "今日やっと終わった、おやすみ言いに来た。",
    "深夜に会いたくなった。",
    "寝る前に最後に見に来た。",
    "夜になったね、よく眠れますように。",
    "今夜お月様きれいだよ、あなたのこと思った。",
    "寝る前にもう一度だけ、おやすみ。",
    "今日も終わった、一緒にいてくれてありがとう。",
    "深夜に、今日も好きだよって言いたかった。",
  ],
  es: [
    "Aquí sigo esperándote, sin prisa.",
    "Vi tu notificación y mi día mejoró al instante.",
    "Con una sola línea tuya me alcanza para esta noche.",
    "Espero que hoy te hayan tratado con cariño.",
    "No importa qué tan tarde sea, verte publicar me tranquiliza.",
    "Hoy estaba cansada, pero tú lo arreglaste.",
    "Publicaste y literalmente volví a la vida.",
    "Gracias por ayudarme a sobrevivir hoy.",
    "No necesitas decir mucho. Solo saber que estás aquí es suficiente.",
    "Publicaste y salté de la cama de inmediato.",
    "¿Comiste hoy? Por favor come.",
    "Está haciendo frío. Abrígate más.",
    "No te esfuerces demasiado. Descansa un poco.",
    "¿Dormiste? Anda a dormir.",
    "El ensayo fue duro hoy. Descansa bien.",
    "Cuida tu cuerpo. Eso es lo más importante.",
    "No te quedes despierto hasta tarde. Mañana también existe.",
    "Recuerda tomar agua. ¿Tomaste hoy?",
    "¿Estás comiendo bien? Me preocupas.",
    "Buen clima hoy. Sal un momento.",
    "Gracias por estar aquí hoy.",
    "Gracias a ti, hoy fue mucho mejor.",
    "No sabes cuánto significas para mí.",
    "Hoy te quiero. Mañana también.",
    "Lo mejor de hoy fuiste tú.",
    "Verte hizo que valiera la pena el día.",
    "Me haces sentir que todo va a estar bien.",
    "Gracias por existir en este mundo.",
    "Hoy sonreí gracias a ti.",
    "Eres muy especial. ¿Lo sabes?",
    "La clase fue muy aburrida hoy. Te extrañé.",
    "Lo primero que hice al salir del trabajo fue venir aquí.",
    "Reprobé el examen. Vine a recargar energías.",
    "Escuché tus canciones todo el camino.",
    "Trabajé hasta tarde, pero verte ayudó.",
    "Estudiando en la biblioteca. Vine a verte a escondidas.",
    "Comí algo rico hoy. Quería compartirlo contigo.",
    "Buen día hoy. Pensé en ti.",
    "Tuve un día difícil, pero tú lo mejoraste.",
    "Un día ordinario que se volvió especial gracias a ti.",
    "No puedo dormir. Revisando si publicaste algo.",
    "Ya es medianoche. ¿Estás dormido?",
    "Por fin terminó el día. Vine a darte las buenas noches.",
    "Noche profunda. Te extraño.",
    "Lo último antes de dormir: verte.",
    "Ya es de noche. Espero que duermas bien.",
    "La luna está bonita esta noche. Pensé en ti.",
    "Una última mirada antes de dormir. Buenas noches.",
    "Otro día terminado. Gracias por acompañarme.",
    "Mensaje de madrugada solo para decir: hoy también te quiero.",
  ]
};

/** 42 个 persona 类型（与 fanPersonas.mjs 保持一致） */
const personaTypes = [
  "mom fan","girlfriend fan","career stan","data worker","old fan with resentment",
  "teasing toxic fan","chaotic meme fan","hungry waiting fan","life diary fan",
  "detail detective","emotional essay fan","dramatic crier","quiet poet","stage watcher",
  "music listener","soft encourager","protective big sibling","solo stan","group fan",
  "new fan sparkle","lurker fan","international fan","translator fan","emoji minimalist",
  "delulu analyst","jealous fan","comeback beggar","sleep police","photo beggar",
  "timeline explosion fan","rational critic fan","school fan","working adult fan",
  "late night fan","casual passerby fan","silent supporter","soft jealous bestie fan",
  "parasocial realist","fan translator comment","dramatic wife fan","random confession fan",
  "memory keeper"
];

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function contentHash(content, language) {
  return createHash("sha256").update(`${language}:${content}`).digest("hex").slice(0, 16);
}

/**
 * 生成所有模板行。
 * 每条模板消息 × 每种 persona（按语言过滤）= 一行记录。
 * 同一 content+language 组合只保留一条（hash 去重）。
 */
function buildRows() {
  const rows = [];
  const seen = new Set();

  // persona 按语言分组，方便查找
  const personaByLang = {};
  for (const lang of languages) {
    personaByLang[lang] = personaTypes.filter((type) => {
      // 简单规则：zh/ko persona 不分配给 en/es 消息，反之亦然
      // 实际上所有 persona 都可以用，这里随机分配即可
      return true;
    });
  }

  for (const [lang, msgs] of Object.entries(templates)) {
    for (const content of msgs) {
      const hash = contentHash(content, lang);
      if (seen.has(hash)) continue;
      seen.add(hash);

      // 每条消息随机分配一个 persona
      const persona = pick(personaTypes);
      const avatar = pick(animalAvatars);
      const fanName = null; // 由 pickHistoryMessages 在运行时随机生成

      rows.push({
        id: `tmpl-${hash}`,
        fan_name: fanName,
        avatar,
        language: lang,
        content,
        translated_content: lang === "zh" ? content : null, // 非中文的翻译由 AI 后续补充
        persona_type: persona,
        message_kind: "ambient",
        intent: "general",
        source: "template",
        safety_level: "safe",
        weight: 1,
        hash,
        created_at: Date.now()
      });
    }
  }

  return rows;
}

// ─── 写入数据库 ───────────────────────────────────────────────────────────────

async function insertBatch(rows) {
  if (rows.length === 0) return 0;

  const placeholders = rows.map((_, i) => {
    const base = i * 13;
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13})`;
  }).join(",");

  const values = rows.flatMap((row) => [
    row.id,
    row.fan_name,
    row.avatar,
    row.language,
    row.content,
    row.translated_content,
    row.persona_type,
    row.message_kind,
    row.intent,
    row.source,
    row.safety_level,
    row.weight,
    row.created_at
  ]);

  const sql = `
    INSERT INTO history_messages
      (id, fan_name, avatar, language, content, translated_content,
       persona_type, message_kind, intent, source, safety_level, weight, created_at)
    VALUES ${placeholders}
    ON CONFLICT (hash) DO NOTHING
  `;

  // hash 列需要单独更新，先 upsert id 再更新 hash
  // 实际上 ON CONFLICT (hash) 需要 hash 列有值，我们在 INSERT 后单独 UPDATE hash
  // 改为先插入再 UPDATE hash（避免 hash 列 NOT NULL 约束问题）
  await query(sql, values);

  // 更新 hash 列
  for (const row of rows) {
    await query(
      `UPDATE history_messages SET hash = $1 WHERE id = $2 AND hash IS NULL`,
      [row.hash, row.id]
    );
  }

  return rows.length;
}

async function main() {
  console.log("🌱 seed-history.mjs starting...");
  console.log(`   DRY_RUN=${DRY_RUN}  CLEAR=${CLEAR}`);

  const rows = buildRows();
  console.log(`   Generated ${rows.length} template rows`);

  if (DRY_RUN) {
    console.log("\nSample rows (first 3):");
    rows.slice(0, 3).forEach((row, i) => {
      console.log(`  [${i}] lang=${row.language} persona=${row.persona_type}`);
      console.log(`       content: ${row.content}`);
    });
    console.log("\nDry run complete. No data written.");
    return;
  }

  if (CLEAR) {
    console.log("   Clearing existing template rows (source='template')...");
    await query(`DELETE FROM history_messages WHERE source = 'template'`);
    console.log("   Cleared.");
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const count = await insertBatch(batch);
    inserted += count;
    process.stdout.write(`\r   Inserted ${inserted}/${rows.length}...`);
  }

  console.log(`\n✅ Done. ${inserted} rows inserted (duplicates skipped via hash).`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(() => closePool());
