# ============================================================
# weekly-remind.ps1 — Task Scheduler chạy thứ 6 10h (bán tự động).
# 1) export dữ liệu spy mới nhất từ Supabase (report-input.json).
# 2) nhắc: tạo file trên Desktop + thông báo bong bóng.
# KHÔNG chạy Claude (headless cần API). Bạn mở Claude Code gõ /weekly-report để phân tích + đẩy.
# ============================================================
$ErrorActionPreference = "Continue"
$proj = "C:\Users\anhdk\Downloads\seryn-spy-dashboard-main (1)\seryn-spy-dashboard-main"
$logdir = Join-Path $proj "scripts\logs"
New-Item -ItemType Directory -Force -Path $logdir | Out-Null
$log = Join-Path $logdir ("weekly-remind-" + (Get-Date -Format "yyyy-MM-dd") + ".log")
Set-Location $proj
("[{0}] BẮT ĐẦU export" -f (Get-Date)) | Tee-Object -FilePath $log -Append

node scripts/report-export.mjs 2>&1 | Tee-Object -FilePath $log -Append
$ok = ($LASTEXITCODE -eq 0)

$desktop = [Environment]::GetFolderPath("Desktop")
$note = Join-Path $desktop "SERYN — cập nhật báo cáo tuần.txt"
$msg = if ($ok) {
@"
DỮ LIỆU SPY ADS TUẦN ĐÃ SẴN SÀNG ($(Get-Date -Format 'dd/MM/yyyy HH:mm')).

Để cập nhật báo cáo lên dashboard:
1. Mở Claude Code TẠI thư mục dự án:
   $proj
2. Gõ lệnh:  /weekly-report
   (hoặc nói: "cập nhật báo cáo tuần")
3. Claude sẽ phân tích bằng skill và đẩy báo cáo lên dashboard.

(File này tự tạo mỗi thứ 6 10h. Xóa sau khi làm xong cho gọn.)
"@
} else {
"EXPORT LỖI lúc $(Get-Date -Format 'dd/MM/yyyy HH:mm') — kiểm tra scripts\logs\ hoặc kết nối Supabase."
}
Set-Content -Path $note -Value $msg -Encoding UTF8
$stat = if ($ok) { "export OK" } else { "export LỖI" }
("[{0}] {1} — đã tạo file nhắc Desktop" -f (Get-Date), $stat) | Tee-Object -FilePath $log -Append

# Thông báo bong bóng (best-effort, không chặn)
try {
  Add-Type -AssemblyName System.Windows.Forms
  $ni = New-Object System.Windows.Forms.NotifyIcon
  $ni.Icon = [System.Drawing.SystemIcons]::Information
  $ni.Visible = $true
  $ni.BalloonTipTitle = "SERYN Spy Ads"
  $ni.BalloonTipText = if ($ok) { "Dữ liệu tuần đã sẵn sàng. Mở Claude Code gõ /weekly-report để cập nhật báo cáo." } else { "Export lỗi — xem log." }
  $ni.ShowBalloonTip(15000)
  Start-Sleep -Seconds 16
  $ni.Dispose()
} catch { ("[{0}] balloon skip: {1}" -f (Get-Date), $_.Exception.Message) | Tee-Object -FilePath $log -Append }
("[{0}] XONG" -f (Get-Date)) | Tee-Object -FilePath $log -Append
