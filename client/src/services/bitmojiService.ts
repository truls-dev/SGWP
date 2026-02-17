
const SELFIE_STICKER_ID = "8c315eb6-cba4-4865-8746-a999698198b6";
const PEEKING_COMIC_ID = 10211153;

const AVATAR_POOL = [
  "280531978_4-s1", "280531979_4-s1", "280531980_4-s1", "280531981_4-s1", "280531982_4-s1",
  "280531983_4-s1", "280531984_4-s1", "280531985_4-s1", "280531986_4-s1", "280531987_4-s1",
  "121464857_22-s1", "121464858_22-s1", "121464859_22-s1", "121464860_22-s1", "121464861_22-s1",
  "121464862_22-s1", "121464863_22-s1", "121464864_22-s1", "121464865_22-s1", "121464866_22-s1",
  "270452360_2-s1", "270452361_2-s1", "270452362_2-s1", "270452363_2-s1", "270452364_2-s1",
  "270452365_2-s1", "270452366_2-s1", "270452367_2-s1", "270452368_2-s1", "270452369_2-s1",
  "270452370_2-s1", "270452371_2-s1", "270452372_2-s1", "270452373_2-s1", "270452374_2-s1",
  "270452375_2-s1", "270452376_2-s1", "270452377_2-s1", "270452378_2-s1", "270452379_2-s1",
  "128256895_1-s1", "128256896_1-s1", "128256897_1-s1", "128256898_1-s1", "128256899_1-s1",
  "128256900_1-s1", "128256901_1-s1", "128256902_1-s1", "128256903_1-s1", "128256904_1-s1",
  "128256905_1-s1", "128256906_1-s1", "128256907_1-s1", "128256908_1-s1", "128256909_1-s1",
  "128257000_1-s1", "128257001_1-s1", "128257002_1-s1", "128257003_1-s1", "128257004_1-s1",
  "128257005_1-s1", "128257006_1-s1", "128257007_1-s1", "128257008_1-s1", "128257009_1-s1"
];

export const getRandomAvatarId = (): string => {
  return AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
};

export const makePanelUrl = (stickerIdOrComicId: string | number, avatarId: string): string => {
  return `https://sdk.bitmoji.com/render/panel/${stickerIdOrComicId}-${avatarId}-v1.png?transparent=1&palette=1`;
};

export const getSelfieUrlForAvatar = (avatarId: string): string => {
  return makePanelUrl(SELFIE_STICKER_ID, avatarId);
};

export const getPeekingUrlForAvatar = (avatarId: string): string => {
  return makePanelUrl(PEEKING_COMIC_ID, avatarId);
};

export const renderFromTemplateSrc = (srcTemplate: string, avatarA: string, avatarB?: string): string => {
  const parts = srcTemplate.split('%s');
  if (parts.length === 2) {
    return parts[0] + avatarA + parts[1];
  } else if (parts.length === 3) {
    return parts[0] + avatarA + parts[1] + (avatarB || avatarA) + parts[2];
  }
  return srcTemplate;
};
