/** Meta ビジネス（上位）単位で行を束ねる（設定・キャンペーン・レポートで共通） */

export interface MetaBusinessGroup<T> {
  key: string;
  title: string;
  subtitle: string;
  accounts: T[];
}

export type MetaBusinessRow = {
  business_id?: string;
  business_name?: string;
};

export function groupByMetaBusiness<T extends MetaBusinessRow>(
  rows: T[],
  ungroupedLabel: string
): MetaBusinessGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const bid = (row.business_id || '').trim();
    const bname = (row.business_name || '').trim();
    const key = bid || bname || '__ungrouped__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  const entries = Array.from(map.entries());
  entries.sort(([a], [b]) => {
    if (a === '__ungrouped__') return 1;
    if (b === '__ungrouped__') return -1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
  return entries.map(([key, accounts]) => {
    const first = accounts[0]!;
    const title =
      key === '__ungrouped__'
        ? ungroupedLabel
        : first.business_name || first.business_id || key;
    const subtitle =
      key !== '__ungrouped__' && first.business_id ? `ID: ${first.business_id}` : '';
    return { key, title, subtitle, accounts };
  });
}

/** 紐づく Meta 広告アカウント（内部 PK）単位で行を束ねる（キャンペーン一覧・レポート） */

export interface MetaAdAccountGroup<T> {
  key: string;
  title: string;
  subtitle: string;
  accounts: T[];
}

export type MetaAdAccountRow = {
  meta_account?: number | null;
  meta_account_name?: string;
  meta_account_id_str?: string;
};

export function groupByLinkedMetaAdAccount<T extends MetaAdAccountRow>(
  rows: T[],
  ungroupedLabel: string
): MetaAdAccountGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const pk =
      row.meta_account !== undefined && row.meta_account !== null
        ? String(row.meta_account)
        : '__ungrouped__';
    if (!map.has(pk)) map.set(pk, []);
    map.get(pk)!.push(row);
  }
  const entries = Array.from(map.entries());
  entries.sort(([keyA, listA], [keyB, listB]) => {
    if (keyA === '__ungrouped__') return 1;
    if (keyB === '__ungrouped__') return -1;
    const na = listA[0]?.meta_account_name || keyA;
    const nb = listB[0]?.meta_account_name || keyB;
    const cmp = na.localeCompare(nb, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return keyA.localeCompare(keyB);
  });
  return entries.map(([key, accounts]) => {
    const first = accounts[0]!;
    const title =
      key === '__ungrouped__'
        ? ungroupedLabel
        : first.meta_account_name || `Meta #${key}`;
    const subtitle =
      key !== '__ungrouped__' && first.meta_account_id_str
        ? `ID: ${first.meta_account_id_str}`
        : '';
    return { key, title, subtitle, accounts };
  });
}
