export const permitGroups = [
  {
    "id": "紅兜",
    "label": "紅兜アオアシラ",
    "slug": "redhelm",
    "legacy": true
  },
  {
    "id": "大雪主",
    "label": "大雪主ウルクスス",
    "slug": "snowbaron",
    "legacy": true
  },
  {
    "id": "矛砕",
    "label": "矛砕ダイミョウザザミ",
    "slug": "stonefist",
    "legacy": true
  },
  {
    "id": "紫毒姫",
    "label": "紫毒姫リオレイア",
    "slug": "dreadqueen",
    "legacy": true
  },
  {
    "id": "岩穿",
    "label": "岩穿テツカブラ",
    "slug": "drilltusk",
    "legacy": true
  },
  {
    "id": "白疾風",
    "label": "白疾風ナルガクルガ",
    "slug": "silverwind",
    "legacy": true
  },
  {
    "id": "宝纏",
    "label": "宝纏ウラガンキン",
    "slug": "crystalbeard",
    "legacy": true
  },
  {
    "id": "隻眼",
    "label": "隻眼イャンガルルガ",
    "slug": "deadeye",
    "legacy": true
  },
  {
    "id": "黒炎王",
    "label": "黒炎王リオレウス",
    "slug": "dreadking",
    "legacy": true
  },
  {
    "id": "金雷公",
    "label": "金雷公ジンオウガ",
    "slug": "thunderlord",
    "legacy": true
  },
  {
    "id": "荒鉤爪",
    "label": "荒鉤爪ティガレックス",
    "slug": "grimclaw",
    "legacy": true
  },
  {
    "id": "燼滅刃",
    "label": "燼滅刃ディノバルド",
    "slug": "hellblade",
    "legacy": true
  },
  {
    "id": "朧隠",
    "label": "朧隠ホロロホルル",
    "slug": "nightcloak",
    "legacy": false
  },
  {
    "id": "鎧裂",
    "label": "鎧裂ショウグンギザミ",
    "slug": "rustrazor",
    "legacy": false
  },
  {
    "id": "天眼",
    "label": "天眼タマミツネ",
    "slug": "soulseer",
    "legacy": false
  },
  {
    "id": "青電主",
    "label": "青電主ライゼクス",
    "slug": "boltreaver",
    "legacy": false
  },
  {
    "id": "銀嶺",
    "label": "銀嶺ガムート",
    "slug": "elderfrost",
    "legacy": false
  },
  {
    "id": "鏖魔",
    "label": "鏖魔ディアブロス",
    "slug": "bloodbath",
    "legacy": false
  }
] as const;
export const permitGroupLabel = (id: string) => permitGroups.find(g => g.id === id)?.label ?? id;
