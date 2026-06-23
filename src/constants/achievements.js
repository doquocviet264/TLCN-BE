// Phai khop voi danh sach ACHIEVEMENTS (type: "provinces") o
// TLCN-FE/src/lib/achievements.ts de viec gan thanh tuu cho mot ky niem
// dung voi nhung gi trang Thanh tuu hien thi cho user.
export const PROVINCE_ACHIEVEMENTS = [
  { id: "first_step", requirement: 1 },
  { id: "explorer_5", requirement: 5 },
  { id: "explorer_10", requirement: 10 },
  { id: "explorer_20", requirement: 20 },
  { id: "explorer_35", requirement: 35 },
  { id: "explorer_50", requirement: 50 },
  { id: "explorer_63", requirement: 63 },
];

export function findAchievementForProvinceCount(count) {
  return PROVINCE_ACHIEVEMENTS.find((a) => a.requirement === count) || null;
}

// Danh hieu cao nhat user dang giu (de hien thi canh ten tren ban tin),
// khac voi findAchievementForProvinceCount (chi khop dung moc vua dat).
export function findHighestAchievementForProvinceCount(count) {
  let highest = null;
  for (const a of PROVINCE_ACHIEVEMENTS) {
    if (count >= a.requirement) highest = a;
  }
  return highest;
}
