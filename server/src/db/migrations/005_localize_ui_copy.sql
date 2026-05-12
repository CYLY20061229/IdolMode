ALTER TABLE profiles
  ALTER COLUMN nickname SET DEFAULT '新艺人',
  ALTER COLUMN signature SET DEFAULT '今晚也在练习如何温柔地发光。',
  ALTER COLUMN avatar SET DEFAULT '新';

UPDATE profiles
SET
  nickname = CASE WHEN nickname = 'New Idol' THEN '新艺人' ELSE nickname END,
  signature = CASE
    WHEN signature = 'Tonight I am practicing how to shine softly.'
    THEN '今晚也在练习如何温柔地发光。'
    ELSE signature
  END,
  avatar = CASE WHEN avatar = 'IM' THEN '新' ELSE avatar END,
  updated_at = now()
WHERE
  nickname = 'New Idol'
  OR signature = 'Tonight I am practicing how to shine softly.'
  OR avatar = 'IM';

UPDATE artists
SET
  bio = CASE id
    WHEN 'artist-1' THEN '梦感独立歌手，像深夜语音留言一样温柔。'
    WHEN 'artist-2' THEN '有柔软故障心跳的虚拟偶像，擅长宇宙感舞台。'
    WHEN 'artist-3' THEN '带一点温柔混乱感的乐队主唱，歌词里有咖啡和清晨排练。'
    WHEN 'artist-4' THEN '说话很轻的舞者，会认真收藏粉丝的小愿望。'
    ELSE bio
  END,
  signature = CASE id
    WHEN 'artist-1' THEN '小小月亮，也能站上大舞台。'
    WHEN 'artist-2' THEN '信号已连接，心跳在线。'
    WHEN 'artist-3' THEN '还在唱，也还在这里。'
    WHEN 'artist-4' THEN '再向你靠近一步。'
    ELSE signature
  END,
  identity = CASE id
    WHEN 'artist-1' THEN '独立歌手'
    WHEN 'artist-2' THEN '虚拟偶像'
    WHEN 'artist-3' THEN '乐队主唱'
    WHEN 'artist-4' THEN '舞者'
    ELSE identity
  END,
  intro = CASE id
    WHEN 'artist-1' THEN 'Mira 写温暖的合成器流行曲，排练结束后总会给粉丝留下一点很轻的晚安。'
    WHEN 'artist-2' THEN 'Nova 活跃在数字舞台里，把每一次聊天都当成只有彼此知道的小星座。'
    WHEN 'artist-3' THEN 'Eden 是虚构独立乐队的主唱，喜欢把排练日记和没说出口的心情发给粉丝。'
    WHEN 'artist-4' THEN 'Sora 会分享后台的小瞬间、困困的近况，还有练习室里一点一点长出来的勇气。'
    ELSE intro
  END,
  updated_at = now()
WHERE id IN ('artist-1', 'artist-2', 'artist-3', 'artist-4');
