import {
  fetchAccounts,
  fetchClearances,
  issueClearance as issueClearanceApi,
  markAccountPaid as markAccountPaidApi,
  revokeClearance as revokeClearanceApi,
} from "./api";

export interface StudentAccount {
  id: string;
  name: string;
  program: string;
  assessed: number;
  paid: number;
  balance: number;
}

export interface ClearanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  program: string;
  amountCleared: number;
  referenceNumber: string;
  issuedAt: string;
  issuedBy: string;
  semester: string;
  status: "issued" | "revoked";
  createdAt: string;
}

export const CLEARANCE_EVENT = "bwest:clearance-changed";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLEARANCE_EVENT));
}

export async function getAccounts(): Promise<StudentAccount[]> {
  return fetchAccounts();
}

export async function markAccountPaid(studentId: string) {
  const account = await markAccountPaidApi(studentId);
  broadcastUpdate();
  return account;
}

export async function getClearances(): Promise<ClearanceRecord[]> {
  return fetchClearances();
}

export async function issueClearance(
  account: StudentAccount,
  opts: { issuedBy: string; semester: string },
): Promise<{ ok: true; record: ClearanceRecord } | { ok: false; error: string }> {
  if (account.balance > 0) {
    return { ok: false, error: "Cannot issue clearance — outstanding balance remaining." };
  }

  try {
    const record = await issueClearanceApi(account.id, opts.issuedBy, opts.semester);
    broadcastUpdate();
    return { ok: true, record };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to issue clearance",
    };
  }
}

export async function revokeClearance(id: string) {
  const record = await revokeClearanceApi(id);
  broadcastUpdate();
  return record;
}
