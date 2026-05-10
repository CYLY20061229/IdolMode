# 粉丝类型与昵称池

这些配置目前主要在：

- 前端 mock fallback: `services/mockData.ts`
- 正式阿里云后端: `server/src/fanPersonas.mjs`

正式上线时，优先修改 `server/src/fanPersonas.mjs`。如果希望断网/mock 时也一致，再同步修改 `services/mockData.ts`。

## 粉丝类型

当前共 42 个粉丝类型。

| 类型 | 简述 |
| --- | --- |
| mom fan | 亲妈粉，关心吃饭睡觉和身体状态 |
| girlfriend fan | 女友粉/梦女感，心动、吃醋、破防但不越界 |
| career stan | 事业批，关心作品、舞台、回归和练习 |
| data worker | 数据粉/打投粉，负责榜单、播放、宣传，直接但忠诚 |
| old fan with resentment | 老粉，怀念过去，吐槽营业少但感情很深 |
| teasing toxic fan | 嘴毒但还爱，可抱怨失望但不真实攻击 |
| chaotic meme fan | 抽象发疯粉，互联网梗多，夸张搞笑 |
| hungry waiting fan | 等饭粉，长期等营业/自拍/新歌，卑微求投喂 |
| life diary fan | 生活汇报型，自说自话分享上学上班吃饭通勤小事 |
| detail detective | 细节侦探粉，观察时间、标点、emoji 和线索 |
| emotional essay fan | 小作文粉，把 idol 的话和自己生活联系起来 |
| dramatic crier | 破防大哭粉，短句、啊啊啊、救命、哭了 |
| quiet poet | 文艺粉，月亮、夜晚、风雨灯海等意象 |
| stage watcher | 舞台粉，关注唱功舞蹈表情管理和练习痕迹 |
| music listener | 作品粉/歌迷，讨论旋律、歌词、音色、编曲 |
| soft encourager | 稳定温柔粉，不施压，只陪伴和鼓励 |
| protective big sibling | 姐姐粉/哥哥粉，成熟现实，保护欲强 |
| solo stan | 唯粉感，只关心 idol 本人，护短但不攻击他人 |
| group fan | 团粉，关注组合氛围、成员互动、团队舞台 |
| new fan sparkle | 新粉，刚入坑，兴奋又小心翼翼 |
| lurker fan | 潜水粉，平时安静，突然真诚出现 |
| international fan | 海外粉，提到时差、距离、翻译、跨语言陪伴 |
| translator fan | 翻译组/搬运粉，关心多语言粉丝能不能看懂 |
| emoji minimalist | 极简 emoji 粉，用很短文字和 emoji 表达 |
| delulu analyst | 脑补分析粉，把普通话分析出很多层 |
| jealous fan | 吃醋粉，撒娇式占有欲，不威胁 |
| comeback beggar | 回归乞讨粉，一直问新歌舞台专辑巡演 |
| sleep police | 睡觉警察，假装生气催睡，本质关心 |
| photo beggar | 自拍乞讨粉，可爱催照片/练习室照/生活照 |
| timeline explosion fan | 时间线爆炸粉，反应快、句子短、情绪强 |
| rational critic fan | 理智粉，温和指出问题，批评但不恶毒 |
| school fan | 学生粉，早八考试作业晚自习图书馆 |
| working adult fan | 打工人粉，加班通勤领导工资，下班后补能 |
| late night fan | 深夜粉，凌晨出现，更柔软脆弱 |
| casual passerby fan | 路人粉，克制，慢慢有点在意 |
| silent supporter | 默默支持型，不夸张但一直都在 |
| soft jealous bestie fan | 朋友式轻微吃醋，亲近撒娇不恶意 |
| parasocial realist | 清醒粉，知道不是私人关系但真诚感谢陪伴 |
| fan translator comment | 海外评论区粉，简单外语强烈情绪，有翻译软件感 |
| dramatic wife fan | 老婆粉/老公粉，恋爱口吻撒娇吃醋，不露骨 |
| random confession fan | 突然告白型，深夜没头没尾的真心话 |
| memory keeper | 记忆型粉丝，记得过去话语、舞台、早期作品 |

## 昵称池

当前共 289 个昵称：

- 正常/亲密/可爱/粉圈昵称：220 个
- 抽象发疯昵称：35 个
- 可控毒舌昵称：34 个

当前随机权重：

- 68% 正常昵称
- 22% 抽象发疯昵称
- 10% 可控毒舌昵称

我没有按 30% 毒舌直接上，是为了降低 App Store/内容安全风险，也避免详细页过度攻击艺人，破坏“被关心”的核心体验。

```text
见 server/src/fanPersonas.mjs:
- normalFanNicknamePool
- chaoticFanNicknamePool
- toxicFanNicknamePool
```

## 头像池

当前共 20 个卡通动物头像。

```text
🐰 🐱 🐶 🐼 🦊 🐻 🐹 🐨 🐯 🦁
🐮 🐸 🐵 🐧 🐥 🦄 🐺 🐙 🦔 🦦
```

## 修改建议

想让类型更真实，可以给每个类型继续加：

- 典型句式
- 不喜欢说的话
- 常用 emoji
- 语言比例
- 是否更容易回应艺人消息
- 是否更常自说自话

后续可以把 `fanPersonas` 从代码迁移到数据库或 CMS，让运营同学直接配置。
