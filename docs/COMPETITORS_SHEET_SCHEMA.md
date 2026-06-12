# Tab `Competitors` — schema watchlist đối thủ

Google Sheet (cùng file chứa 5 tab dashboard) cần thêm **một tab tên `Competitors`**.
Script `npm run spy:weekly` đọc tab này để biết brand nào cần pull ads.

## Header (dòng 1, đúng tên cột)

```
brand_name,page_ids,page_urls,active,notes
```

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `brand_name` | Tên thương hiệu đối thủ | `Bệnh viện JW Hàn Quốc` |
| `page_ids` | 1 hoặc nhiều Facebook Page ID, phân cách bằng `|` | `400844936646543\|101055868985301` |
| `page_urls` | URL page (tham khảo, hiển thị dashboard) | `https://www.facebook.com/benhvienjw.vn` |
| `active` | `TRUE` để xử lý, ngược lại bỏ qua | `TRUE` |
| `notes` | Ghi chú tùy ý | `chạy ad qua page bác sĩ` |

## Quy tắc xử lý

- ✅ **Chỉ xử lý dòng có `active=TRUE`** (chấp nhận `TRUE/true/1/yes/x/có`). Dòng khác bị bỏ qua.
- ✅ `page_ids` có thể chứa **nhiều ID**, phân cách bằng dấu `|`.
- ⚠️ **Thiếu `page_ids`** → **skip brand đó** và ghi warning trong log (`[!] Brand "..." thiếu page_ids`).
- 🚫 **Không bịa `page_id`.** Nếu chưa biết page ID thật thì để brand `active=FALSE` cho tới khi có.

## Ghi chú

- Nếu tab `Competitors` **trống / chưa tồn tại** và đang chạy `ADS_SOURCE_PROVIDER=mock`,
  script tự dùng **danh sách mặc định 5 brand** (kèm page_id đã biết) để test pipeline,
  và ghi warning báo đang dùng default. Với `provider=custom` thì không có brand → dừng.
- Ví dụ dữ liệu mẫu:

```
brand_name,page_ids,page_urls,active,notes
Bệnh viện JW Hàn Quốc,400844936646543|101055868985301,https://www.facebook.com/benhvienjw.vn,TRUE,JW chạy ad qua page BV + bác sĩ
Viện Thẩm Mỹ LG Clinic,138495609852248,https://www.facebook.com/vienthammylgclinic,TRUE,
Bệnh viện Thẩm mỹ Kangnam,359285057508884,https://www.facebook.com/Thammykangnam,TRUE,
Thẩm mỹ viện Ngọc Dung,372398605948395,https://www.facebook.com/ngocdungbeautycenter,TRUE,
Pensilia Beauty Clinic,108600987972847,https://www.facebook.com/pensilia,TRUE,
```
