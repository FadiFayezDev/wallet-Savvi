import { getFirst, getAll, runQuery, runInTransaction } from '@/src/db/client';
import { transactionService } from './transactionService';
import { nowIso } from '@/src/utils/date';
import type { Goal, GoalDetails } from '@/src/types/domain';
import type { CreateGoalInput, UpdateGoalInput, TransferToGoalInput } from '@/src/types/dto';

export const goalService = {
  async createGoal(input: CreateGoalInput) {
    const now = nowIso();
    return await runQuery(
      `INSERT INTO goals (
        name, target_amount, saved_amount, monthly_contribution, 
        icon, deadline, note, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?);`,
      [
        input.name,
        input.targetAmount,
        input.savedAmount || 0,
        input.monthlyContribution || null,
        input.icon || 'target',
        input.deadline || null,
        input.note || null,
        now,
        now,
      ]
    );
  },

  async depositToGoal(goalId: number, amount: number) {
    return await this.transferToGoal({
      goalId,
      amount,
      occurredAt: nowIso(),
    });
  },

  async withdrawFromGoal(goalId: number, amount: number) {
    return await runInTransaction(async (db) => {
      const goal = await this.getGoalById(goalId);
      if (!goal || goal.savedAmount < amount) throw new Error('Insufficient goal funds');

      const transactionId = await transactionService.createSystemTransaction({
        kind: 'goal_refund',
        amount,
        note: `سحب من هدف: ${goal.name}`,
        occurredAt: nowIso(),
      }, db);

      await runQuery(
        `INSERT INTO goal_transactions (goal_id, transaction_id, action, amount, created_at)
         VALUES (?, ?, 'refund', ?, ?);`,
        [goalId, transactionId, amount, nowIso()],
        db
      );

      await runQuery(
        `UPDATE goals SET saved_amount = saved_amount - ?, updated_at = ? WHERE id = ?;`,
        [amount, nowIso(), goalId],
        db
      );
    });
  },

  async updateGoal(id: number, patch: UpdateGoalInput) {
    const now = nowIso();
    return await runQuery(
      `UPDATE goals SET 
        name = COALESCE(?, name),
        target_amount = COALESCE(?, target_amount),
        monthly_contribution = COALESCE(?, monthly_contribution),
        icon = COALESCE(?, icon),
        deadline = COALESCE(?, deadline),
        note = COALESCE(?, note),
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ?;`,
      [
        patch.name,
        patch.targetAmount,
        patch.monthlyContribution,
        patch.icon,
        patch.deadline,
        patch.note,
        patch.status,
        now,
        id,
      ]
    );
  },

  async transferToGoal(input: TransferToGoalInput) {
    return await runInTransaction(async (db) => {
      const goal = await this.getGoalById(input.goalId);
      if (!goal) throw new Error('Goal not found');

      const transactionId = await transactionService.createSystemTransaction({
        kind: 'goal_transfer',
        amount: input.amount,
        note: input.note ?? `تحويل إلى هدف: ${goal.name}`,
        occurredAt: input.occurredAt,
      }, db);

      await runQuery(
        `INSERT INTO goal_transactions (goal_id, transaction_id, action, amount, created_at)
         VALUES (?, ?, 'transfer', ?, ?);`,
        [input.goalId, transactionId, input.amount, nowIso()],
        db
      );

      const newSavedAmount = goal.savedAmount + input.amount;
      const status = newSavedAmount >= goal.targetAmount ? 'completed' : 'active';

      await runQuery(
        `UPDATE goals SET saved_amount = ?, status = ?, updated_at = ? WHERE id = ?;`,
        [newSavedAmount, status, nowIso(), input.goalId],
        db
      );
    });
  },

  async cancelGoal(goalId: number) {
    const now = nowIso();
    return await runInTransaction(async (db) => {
      const goal = await this.getGoalById(goalId);
      if (!goal) throw new Error('Goal not found');
      if (goal.status === 'cancelled') return;

      // refund remaining saved amount to wallet
      if (goal.savedAmount > 0) {
        const transactionId = await transactionService.createSystemTransaction({
          kind: 'goal_refund',
          amount: goal.savedAmount,
          note: `إلغاء هدف: ${goal.name}`,
          occurredAt: now,
        }, db);

        await runQuery(
          `INSERT INTO goal_transactions (goal_id, transaction_id, action, amount, created_at)
           VALUES (?, ?, 'refund', ?, ?);`,
          [goalId, transactionId, goal.savedAmount, now],
          db
        );
      }

      await runQuery(
        `UPDATE goals SET saved_amount = 0, status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?;`,
        [now, now, goalId],
        db
      );
    });
  },

  async getGoalById(id: number): Promise<Goal | null> {
    const row = await getFirst<any>('SELECT * FROM goals WHERE id = ?;', [id]);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      targetAmount: row.target_amount,
      savedAmount: row.saved_amount,
      monthlyContribution: row.monthly_contribution,
      icon: row.icon,
      deadline: row.deadline,
      note: row.note,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async getGoalDetails(goalId: number): Promise<GoalDetails> {
    const goal = await this.getGoalById(goalId);
    if (!goal) throw new Error('Goal not found');

    const rows = await getAll<any>(
      `SELECT gt.*, t.occurred_at as transaction_occurred_at, t.note as transaction_note
       FROM goal_transactions gt
       JOIN transactions t ON t.id = gt.transaction_id
       WHERE gt.goal_id = ?
       ORDER BY t.occurred_at DESC, t.id DESC;`,
      [goalId]
    );

    return {
      goal,
      transfers: rows.map((row) => ({
        id: row.id,
        goalId: row.goal_id,
        transactionId: row.transaction_id,
        action: row.action,
        amount: row.amount,
        createdAt: row.created_at,
        transactionOccurredAt: row.transaction_occurred_at,
        note: row.transaction_note ?? null,
      })),
    };
  },

  // ✅ listGoals — كل الأهداف (active + completed) مرتبة بالأحدث
  async listGoals(): Promise<Goal[]> {
    const rows = await getAll<any>(
      `SELECT * FROM goals WHERE status != 'cancelled' ORDER BY created_at DESC;`
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      targetAmount: row.target_amount,
      savedAmount: row.saved_amount,
      monthlyContribution: row.monthly_contribution,
      icon: row.icon,
      deadline: row.deadline,
      note: row.note,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  // الـ method القديمة — مبقاش فيها فرق كبير بس خليناها للـ backward compatibility
  async listActiveGoals(): Promise<Goal[]> {
    const rows = await getAll<any>(
      `SELECT * FROM goals WHERE status = 'active' ORDER BY created_at DESC;`
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      targetAmount: row.target_amount,
      savedAmount: row.saved_amount,
      monthlyContribution: row.monthly_contribution,
      icon: row.icon,
      deadline: row.deadline,
      note: row.note,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },
};
