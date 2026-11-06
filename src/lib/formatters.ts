export function formatCurrency(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}

export function getCurrentWibTime(): string {
  const now = new Date();
  return (
    now.toLocaleTimeString("id-ID", {
      hour12: false,
      timeZone: "Asia/Jakarta",
    }) + " WIB"
  );
}
