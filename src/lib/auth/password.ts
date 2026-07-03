import bcrypt from "bcryptjs";

const RONDAS = 12;

export async function hashearPassword(password: string): Promise<string> {
  return bcrypt.hash(password, RONDAS);
}

export async function verificarPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
