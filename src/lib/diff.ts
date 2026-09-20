export interface DiffToken {
  text: string;
  kind: "same" | "add" | "del";
}

const norm = (w: string) => w.toLowerCase().replace(/[.,;:"()]/g, "");

/** Word level diff using a longest common subsequence. Inputs are short resume lines. */
export function wordDiff(a: string, b: string): { left: DiffToken[]; right: DiffToken[] } {
  const A = a.split(/\s+/).filter(Boolean);
  const B = b.split(/\s+/).filter(Boolean);
  const n = A.length;
  const m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = norm(A[i]) === norm(B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left: DiffToken[] = [];
  const right: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (norm(A[i]) === norm(B[j])) {
      left.push({ text: A[i], kind: "same" });
      right.push({ text: B[j], kind: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ text: A[i++], kind: "del" });
    } else {
      right.push({ text: B[j++], kind: "add" });
    }
  }
  while (i < n) left.push({ text: A[i++], kind: "del" });
  while (j < m) right.push({ text: B[j++], kind: "add" });
  return { left, right };
}
