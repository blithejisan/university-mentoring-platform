export interface PasswordResetTransaction {
  user: {
    update(args: {
      where: { id: string };
      data: { passwordHash: string; tokenVersion: { increment: number } };
    }): Promise<unknown>;
  };
}

export async function updatePasswordAndInvalidateSessions(
  transaction: PasswordResetTransaction,
  userId: string,
  passwordHash: string
): Promise<void> {
  await transaction.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
}
