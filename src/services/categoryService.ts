import { getAll, runQuery } from '@/src/db/client';
import type { Category, CategoryType } from '@/src/types/domain';
import { assertRequired } from '@/src/utils/validation';
import { CreateCategory } from '../types/dto';

interface CategoryRow {
  id: number;
  name_ar: string;
  name_en: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  is_default: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

const mapCategory = (row: CategoryRow): Category => ({
  id: row.id,
  nameAr: row.name_ar,
  nameEn: row.name_en,
  type: row.type,
  icon: row.icon,
  color: row.color,
  isDefault: Boolean(row.is_default),
  isDeleted: Boolean(row.is_deleted),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const categoryService = {
  async listCategories(type?: CategoryType): Promise<Category[]> {
    if (!type) {
      const rows = await getAll<CategoryRow>(
        'SELECT * FROM categories WHERE is_deleted = 0 ORDER BY name_en ASC;',
      );
      return rows.map(mapCategory);
    }

    const rows = await getAll<CategoryRow>(
      "SELECT * FROM categories WHERE is_deleted = 0 AND (type = ? OR type = 'both') ORDER BY name_en ASC;",
      [type],
    );
    return rows.map(mapCategory);
  },

  async createCategory(input: CreateCategory) {
    assertRequired(input.nameAr, 'Arabic name');
    assertRequired(input.nameEn, 'English name');
    const now = new Date().toISOString();
    await runQuery(
      `INSERT INTO categories (name_ar, name_en, type, icon, color, is_default, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?);`,
      [input.nameAr, input.nameEn, input.type, input.icon ?? null, input.color ?? null, now, now],
    );
  },

  async updateCategory(
    id: number,
    patch: Partial<Pick<Category, 'nameAr' | 'nameEn' | 'type' | 'icon' | 'color'>>,
  ) {
    const now = new Date().toISOString();
    const rows = await getAll<CategoryRow>('SELECT * FROM categories WHERE id = ? LIMIT 1;', [id]);
    const row = rows[0];
    if (!row) throw new Error('Category not found');

    await runQuery(
      `UPDATE categories
       SET name_ar = ?, name_en = ?, type = ?, icon = ?, color = ?, updated_at = ?
       WHERE id = ?;`,
      [
        patch.nameAr ?? row.name_ar,
        patch.nameEn ?? row.name_en,
        patch.type ?? row.type,
        patch.icon ?? row.icon,
        patch.color ?? row.color,
        now,
        id,
      ],
    );
  },

  async deleteCategory(id: number) {
    await runQuery('UPDATE categories SET is_deleted = 1, updated_at = ? WHERE id = ?;', [
      new Date().toISOString(),
      id,
    ]);
  },
};
