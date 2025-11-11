# Tài liệu Đặc tả Use Case hệ thống Quản lý Nhà Trọ

Tài liệu này mô tả chi tiết các Use Case theo góc nhìn người dùng (User) và quản trị (Admin) dựa trên toàn bộ source code hiện có.

---

## Tổng quan Module và Actor

- Module: `auth`, `user`, `room` (public/admin), `contract` (public/admin), `final-contract` (public/protected), `bill` (public/admin), `payment` (VNPay/MoMo/ZaloPay), `tenant` (public/admin), `complaints` (public/admin), `util` (utilities), `utility-fee`, `room-fee`, `log`.
- Actor:
  - Admin: quản trị hệ thống, toàn quyền quản lý dữ liệu.
  - User: người dùng (bao gồm khách/tenant), có quyền truy cập dữ liệu của mình và các route public.

---

## Chính sách Xác thực & Phân quyền

- Xác thực: JWT qua header `Authorization: Bearer <token>`.
- Phân quyền (RBAC):
  - Admin: truy cập toàn bộ hệ thống; tạo tài khoản Tenant/Admin; quản lý phòng, hợp đồng, hóa đơn, tiện ích, khiếu nại, báo cáo, nhật ký; thực hiện check-in; upload hợp đồng final; kích hoạt tài khoản tenant.
  - User (Tenant): chỉ truy cập tài nguyên của mình; xem/tải hợp đồng/hóa đơn/biên lai; thanh toán online/offline; gửi khiếu nại; đổi mật khẩu.
  - `authenticateToken`: yêu cầu đăng nhập, trả 401 nếu thiếu/không hợp lệ.
  - `optionalAuth`: không bắt buộc token; nếu có token hợp lệ thì set `req.user`.
  - Kiểm tra quyền sở hữu: so sánh `req.user._id` với `tenantId`/tài nguyên liên quan.
- Validation: dùng Joi cho `body`, `query`, `params`; trả 400 với chi tiết lỗi.
- Lỗi chung: `errorHandler` chuẩn hóa phản hồi lỗi; `notFound` trả 404 cho route không tồn tại.

---

## Nhóm Use Case: Auth

### Tên Use Case: Đăng ký tài khoản
**Actor**: User (khách/tenant)
**Mô tả**: Người dùng tạo tài khoản mới để đăng nhập hệ thống.
**Điều kiện tiên quyết (Precondition)**: Không đang đăng nhập; thông tin hợp lệ theo schema.

**Luồng chính (Main Flow):**
1. Người dùng gửi `POST /api/register` với `fullName`, `email`, `phone`, `password`, `role?`.
2. Hệ thống kiểm tra email chưa tồn tại.
3. Hash mật khẩu và tạo bản ghi `User` với role mặc định `TENANT` nếu không cung cấp.
4. Trả 201 với thông tin cơ bản của user.

**Luồng phụ (Alternative Flow):**
- Vai trò có thể được chỉ định (nếu hệ thống cho phép), mặc định sẽ là `TENANT`.

**Luồng ngoại lệ (Exception Flow):**
- 400 nếu email đã tồn tại hoặc dữ liệu không hợp lệ theo Joi.
- 500 nếu lỗi máy chủ.

**Điều kiện kết thúc (Postcondition):**
- Tài khoản mới được lưu trong `users` với `passwordHash`.

---

### Tên Use Case: Đăng nhập
**Actor**: User/Admin
**Mô tả**: Đăng nhập để nhận JWT và truy cập các route bảo vệ.
**Điều kiện tiên quyết**: Tài khoản tồn tại, mật khẩu đúng.

**Luồng chính:**
1. Gửi `POST /api/login` với `email`, `password`.
2. Hệ thống tìm user theo email và đối chiếu mật khẩu.
3. Sinh JWT với payload gồm `id`, `role`, thông tin cơ bản.
4. Trả 200 với `token` và thông tin user.

**Luồng ngoại lệ:**
- 400 nếu email/mật khẩu sai.
- 500 nếu lỗi máy chủ.

**Postcondition:**
- Client giữ `token` để gọi các API protected.

---

### Tên Use Case: Đặt lại mật khẩu
**Actor**: User/Admin (đã đăng nhập)
**Mô tả**: Đổi mật khẩu hiện tại sang mật khẩu mới.
**Điều kiện tiên quyết**: Đã đăng nhập; cung cấp `currentPassword`, `newPassword` hợp lệ.

**Luồng chính:**
1. Gửi `PUT /api/reset-password` kèm JWT và body `currentPassword`, `newPassword`.
2. Kiểm tra user tồn tại và mật khẩu hiện tại hợp lệ.
3. Hash mật khẩu mới và cập nhật `passwordHash`.
4. Trả 200 thành công.

**Luồng ngoại lệ:**
- 401 nếu thiếu/invalid token.
- 404 nếu user không tồn tại.
- 400 nếu `currentPassword` sai.
- 500 nếu lỗi máy chủ.

**Postcondition:**
- Mật khẩu mới được lưu; token cũ vẫn còn hiệu lực theo cấu hình.

---

## Nhóm Use Case: User (Quản lý người dùng)

### Tên Use Case: Xem danh sách người dùng
**Actor**: Admin (yêu cầu vai trò); Public có thể xem thông tin tối thiểu nếu không có token.
**Mô tả**: Admin xem danh sách người dùng với phân trang, filter.
**Precondition**: JWT Admin để xem đầy đủ; nếu `optionalAuth` không có token, chỉ trả trường tối thiểu.

**Luồng chính:**
1. Gửi `GET /api/users` với `page`, `limit`, `role`, `keyword?`.
2. Hệ thống áp dụng `optionalAuth` và giới hạn trường theo `req.user.role`.
3. Trả danh sách user và thông tin phân trang.

**Luồng phụ:**
- Tenant đăng nhập thấy thêm `phone`.
- Không đăng nhập: chỉ `fullName`, `role`, `createdAt`.

**Ngoại lệ:**
- 403 nếu cố xem full list nhưng không phải Admin.
- 500 nếu lỗi máy chủ.

**Postcondition:**
- Không thay đổi dữ liệu; chỉ trả kết quả.

---

### Tên Use Case: Xem chi tiết người dùng
**Actor**: Admin/User/Public
**Mô tả**: Xem thông tin 1 user.
**Precondition**: `params.id` hợp lệ.

**Luồng chính:**
1. `GET /api/users/:id` với `optionalAuth`.
2. Chọn trường trả về tùy role như ở danh sách.
3. Trả 200 với dữ liệu.

**Ngoại lệ:**
- 404 nếu không tồn tại.
- 500 lỗi máy chủ.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Admin tạo tài khoản Tenant/Admin
**Actor**: Admin
**Mô tả**: Admin tạo tài khoản mới (Tenant hoặc Admin).
**Precondition**: JWT Admin; body hợp lệ.

**Luồng chính:**
1. `POST /api/users` kèm JWT Admin, body `fullName`, `email`, `phone`, `password`, `role` ∈ {`TENANT`,`ADMIN`}.
2. Kiểm tra trùng email; validate độ dài mật khẩu (≥ 6).
3. Hash mật khẩu và lưu; role đúng theo đầu vào.
4. Trả 201 với dữ liệu cơ bản.

**Ngoại lệ:**
- 400 nếu email trùng hoặc password < 6.
- 403 nếu không đủ quyền.
- 500 lỗi máy chủ.

**Postcondition:**
- Tài khoản mới được tạo.

---

### Tên Use Case: Cập nhật người dùng (Admin)
**Actor**: Admin
**Mô tả**: Admin sửa thông tin user.
**Precondition**: JWT Admin; `params.id` hợp lệ; body hợp lệ.

**Luồng chính:**
1. `PUT /api/users/:id` với các trường cần cập nhật (không cho Tenant tự cập nhật trừ đổi mật khẩu).
2. Kiểm tra email trùng nếu thay đổi; hash mật khẩu nếu cập nhật.
3. Lưu và trả 200.

**Ngoại lệ:**
- 404 nếu không tồn tại.
- 400 nếu email trùng hoặc mật khẩu không đạt yêu cầu.
- 403 nếu không đủ quyền.

**Postcondition:**
- Bản ghi user được cập nhật.

---

### Tên Use Case: Yêu cầu đổi email (User) & Duyệt đổi email (Admin)
**Actor**: User/Admin
**Mô tả**: User gửi yêu cầu đổi email; Admin duyệt cập nhật.
**Precondition**: JWT; `newEmail` hợp lệ.

**Luồng chính:**
1. User gửi yêu cầu đổi email (endpoint ứng dụng tùy thiết kế). 
2. Admin xem danh sách yêu cầu và duyệt: cập nhật `email` user, kiểm tra trùng.
3. Trả kết quả duyệt.

**Ngoại lệ:**
- 400 nếu email không hợp lệ/trùng.
- 403 nếu User tự ý cập nhật mà không qua duyệt.

**Postcondition:**
- Email user được cập nhật sau khi Admin duyệt.

### Tên Use Case: Kích hoạt tài khoản Tenant sau bill_contract = PAID
**Actor**: Admin
**Mô tả**: Admin kích hoạt tài khoản Tenant sau khi hóa đơn kích hoạt hợp đồng đã thanh toán.
**Precondition**: `bill_contract` của Tenant = `PAID`.

**Luồng chính:**
1. Admin kiểm tra trạng thái `bill_contract`.
2. Kích hoạt tài khoản Tenant (endpoint nghiệp vụ nội bộ).
3. Thông báo thành công.

**Ngoại lệ:**
- 400 nếu hóa đơn chưa `PAID`.

**Postcondition:**
- Tài khoản Tenant chuyển sang trạng thái hoạt động.

---

## Nhóm Use Case: Room

### Tên Use Case: Xem danh sách phòng (Public)
**Actor**: Public/User
**Mô tả**: Xem danh sách phòng theo filter và phân trang.
**Precondition**: Không yêu cầu đăng nhập.

**Luồng chính:**
1. `GET /api/rooms/public` với `status`, `type`, `q?`, `page`, `limit`.
2. Hệ thống trả danh sách phòng (đã format: giá, ảnh, cover, tóm tắt hợp đồng hiện tại nếu có).

**Ngoại lệ:**
- 500 nếu lỗi máy chủ.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Xem chi tiết phòng (Public)
**Actor**: Public/User
**Mô tả**: Xem chi tiết một phòng.
**Precondition**: `id` là ObjectId hợp lệ.

**Luồng chính:**
1. `GET /api/rooms/public/:id`.
2. Validate `id`; truy xuất phòng và format dữ liệu.
3. Trả 200.

**Ngoại lệ:**
- 400 nếu ID không hợp lệ.
- 404 nếu không tồn tại.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Quản lý phòng (Admin) – Xem/Tạo/Sửa/Xóa/Disable
**Actor**: Admin
**Mô tả**: CRUD phòng và quản lý ảnh.
**Precondition**: JWT Admin; body/params hợp lệ theo Joi.

**Luồng chính:**
1. Xem danh sách: `GET /api/rooms` với filter query.
2. Xem chi tiết: `GET /api/rooms/:id`.
3. Thêm phòng: `POST /api/rooms` kèm `uploadRoomImages` và `createRoomSchema`.
4. Sửa phòng: `PUT /api/rooms/:id` kèm `uploadRoomImages` và `updateRoomSchema`.
5. Xóa/Disable phòng: `DELETE /api/rooms/:id` hoặc Disable trạng thái `DISABLED` theo chính sách.
6. Quản lý ảnh:
   - Xóa ảnh: `DELETE /api/rooms/:id/images/:publicId`.
   - Đặt ảnh đại diện: `POST /api/rooms/:id/cover` với `publicId`.

**Luồng phụ:**
- Tăng giá khi `cleaningStatus` cập nhật sang `cleaned` (mã nguồn hiện có).
- Tự động merge ảnh từ body và upload.
- Trạng thái phòng theo nghiệp vụ: `EMPTY` / `RENTING` / `MAINTENANCE` / `DISABLED`.
- Tự động đổi trạng thái: Hợp đồng `ACTIVE` → phòng `RENTING`; hợp đồng `EXPIRED/CANCELED` → phòng `EMPTY`.

**Ngoại lệ:**
- 400 nếu ID không hợp lệ hoặc dữ liệu sai.
- 404 nếu không tìm thấy phòng/ảnh.
- 403 nếu không đủ quyền (xóa phòng yêu cầu Admin).
- 500 lỗi máy chủ.

**Postcondition:**
- Phòng/ảnh được cập nhật theo thao tác.

---

## Nhóm Use Case: Contract

### Tên Use Case: Xem hợp đồng của tôi (Tenant)
**Actor**: User
**Mô tả**: Xem danh sách hợp đồng của chính mình.
**Precondition**: JWT User.

**Luồng chính:**
1. `GET /api/contracts/my-contracts` với `page`, `limit`.
2. Trả danh sách đã format (chuyển Decimal128 sang số, populate tenant/room).

**Ngoại lệ:**
- 500 nếu lỗi máy chủ.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Xem hợp đồng (Public theo ID nhưng yêu cầu auth)
**Actor**: User/Admin
**Mô tả**: Lấy hợp đồng theo ID.
**Precondition**: JWT; `id` hợp lệ.

**Luồng chính:**
1. `GET /api/contracts/public/:id`.
2. Trả hợp đồng dạng chi tiết.

**Ngoại lệ:**
- 404 nếu không tồn tại.
- 500 nếu lỗi.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Quản lý hợp đồng (Admin) – Xem/Tạo/Sửa
**Actor**: Admin
**Mô tả**: CRUD hợp đồng.
**Precondition**: JWT Admin; body/params hợp lệ.

**Luồng chính:**
1. Xem danh sách: `GET /api/contracts`.
2. Thêm: `POST /api/contracts`.
3. Xem chi tiết: `GET /api/contracts/:id`.
4. Sửa: `PUT /api/contracts/:id`.
5. Không xóa hợp đồng theo chính sách nghiệp vụ.

**Ngoại lệ:**
- 403 nếu không phải Admin khi thao tác quản trị.
- 404 nếu không tồn tại.
- 500 lỗi máy chủ.

**Postcondition:**
- Hợp đồng chỉ chuyển trạng thái: `DRAFT` → `ACTIVE` → `EXPIRED` / `CANCELED`. Không xóa hợp đồng.

---

## Nhóm Use Case: Final Contract (Hợp đồng cuối)

### Tên Use Case: Tạo bản nháp Final Contract từ Contract
**Actor**: User/Admin (yêu cầu quyền truy cập vào contract)
**Mô tả**: Sau khi đóng đủ tiền cọc, tạo hợp đồng cuối.
**Precondition**: JWT; `contractId` tồn tại; tiền cọc đã thanh toán đủ.

**Luồng chính:**
1. `POST /api/final-contracts` với body `{ contractId, terms? }`.
2. Kiểm tra quyền truy cập (User sở hữu hoặc Admin).
3. Tính tổng tiền đã thanh toán từ các `Bill` của contract và so với `deposit`.
4. Tạo bản nháp FinalContract trạng thái `DRAFT` và trả dữ liệu đã format.

**Ngoại lệ:**
- 400 nếu thiếu `contractId` hoặc chưa thanh toán đủ cọc.
- 403 nếu không có quyền.
- 404 nếu contract không tồn tại.
- 500 lỗi server.

**Postcondition:**
- FinalContract `DRAFT` được lưu với `originContractId`.

---

### Tên Use Case: Upload hợp đồng final (Admin)
**Actor**: Admin
**Mô tả**: Upload file (PDF/ảnh) hợp đồng; chuyển trạng thái.
**Precondition**: JWT Admin; `id` FinalContract hợp lệ.

**Luồng chính:**
1. `POST /api/final-contracts/:id/upload` kèm files qua `uploadFinalContractFiles`.
2. Lưu danh sách file vào `images`, set `tenantSignedAt`, đổi trạng thái `WAITING_SIGN`.
3. Trả 200 với dữ liệu.

**Ngoại lệ:**
- 403 nếu không có quyền.
- 404 nếu không tìm thấy FinalContract.
- 400/500 nếu lỗi upload/validate.

**Postcondition:**
- File đính kèm được lưu; trạng thái cập nhật.

---

### Tên Use Case: Upload CCCD (Xác minh Tenant)
**Actor**: User sở hữu hoặc Admin
**Mô tả**: Upload ảnh/PDF CCCD.
**Precondition**: JWT; `id` hợp lệ.

**Luồng chính:**
1. `POST /api/final-contracts/:id/upload-cccd`.
2. Lưu files vào `cccdFiles`.
3. Trả 200.

**Ngoại lệ:**
- 403, 404 tương tự upload hợp đồng.

**Postcondition:**
- Dữ liệu CCCD gắn với FinalContract.

---

### Tên Use Case: Duyệt chữ ký chủ nhà
**Actor**: Admin
**Mô tả**: Phê duyệt chữ ký chủ nhà; hoàn tất hợp đồng.
**Precondition**: JWT Admin/; `id` hợp lệ.

**Luồng chính:**
1. `PUT /api/final-contracts/:id/approve`.
2. Set `ownerApprovedAt`; nếu đã có `tenantSignedAt` thì set `status = SIGNED` và `finalizedAt`.
3. Trả 200.

**Ngoại lệ:**
- 403 nếu không đủ quyền.
- 404 nếu không tồn tại.

**Postcondition:**
- Hợp đồng cuối ở trạng thái phù hợp (`SIGNED` hoặc `WAITING_SIGN`).

---

### Tên Use Case: Xem file nội tuyến
**Actor**: User sở hữu hoặc Admin
**Mô tả**: Xem file hợp đồng (đặc biệt PDF) inline.
**Precondition**: JWT; `id` hợp lệ; `index` file tồn tại.

**Luồng chính:**
1. `GET /api/final-contracts/public/:id/files/:index/view`.
2. Kiểm tra quyền; nếu file là PDF (Cloudinary `raw`) thì proxy stream; nếu ảnh thì redirect.

**Ngoại lệ:**
- 403 nếu không đủ quyền.
- 404 nếu FinalContract hoặc file không tồn tại.

**Postcondition:**
- Người dùng xem được nội dung file.

---

### Tên Use Case: Tính số tiền còn lại
**Actor**: User sở hữu hoặc Admin
**Mô tả**: Tính tổng tiền còn phải thanh toán trên các hóa đơn liên quan.
**Precondition**: JWT; `id` hợp lệ.

**Luồng chính:**
1. `GET /api/final-contracts/:id/remaining`.
2. Tập hợp các `Bill` của `originContractId`, cộng `amountDue - amountPaid`.
3. Trả 200 với `remaining`.

**Ngoại lệ:**
- 403, 404 nếu không quyền/không tồn tại.

**Postcondition:**
- Không thay đổi dữ liệu.

---

## Nhóm Use Case: Bill

### Tên Use Case: Xem hóa đơn của tôi (Tenant)
**Actor**: User
**Mô tả**: Xem danh sách hóa đơn liên kết với hợp đồng của mình.
**Precondition**: JWT Tenant.

**Luồng chính:**
1. `GET /api/bills/my-bills` với `page`, `limit`.
2. Trả danh sách hóa đơn đã format (lineItems, payments, chuyển Decimal128).

**Ngoại lệ:**
- 500 nếu lỗi.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Xem hóa đơn (Public theo ID nhưng yêu cầu auth)
**Actor**: User/Admin
**Mô tả**: Lấy hóa đơn theo ID.
**Precondition**: JWT; `id` hợp lệ.

**Luồng chính:**
1. `GET /api/bills/public/:id`.
2. Trả hóa đơn đã format.

**Ngoại lệ:**
- 404 nếu không tồn tại.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Quản lý hóa đơn & Thanh toán (Admin/User)
**Actor**: Admin
**Mô tả**: Quản lý hóa đơn theo loại và trạng thái; duyệt offline; người dùng thanh toán online.
**Precondition**: JWT Admin cho quản trị; JWT User cho hóa đơn của mình.

**Luồng chính:**
1. Loại hóa đơn:
   - `bill_receipt` (tiền cọc)
   - `bill_contract` (kích hoạt hợp đồng)
   - `bill_monthly` (hàng tháng)
2. Trạng thái hóa đơn: `UNPAID` → `PARTIALLY_PAID` → `PAID` → `CLOSED` (đóng)
3. Xem danh sách (Admin): `GET /api/bills`; xem của tôi (User): `GET /api/bills/my-bills`.
4. Xem chi tiết: `GET /api/bills/:id` hoặc `/public/:id` theo quyền.
5. Tạo/Sửa (Admin): `POST /api/bills`, `PUT /api/bills/:id`.
6. Duyệt offline (Admin): chuyển trạng thái hóa đơn sang `PAID` khi thanh toán tiền mặt.
7. Không xóa hóa đơn theo chính sách; trạng thái `CLOSED` dùng để đóng.

**Luồng phụ:**
- Khi cập nhật `status = PAID`, hệ thống tự động chuyển `amountDue -> amountPaid` và thêm bản ghi `payments` tự động.
- Nếu `status` hiện tại `PAID`, không cho đổi về `UNPAID/CLOSED`.
- Nếu `status` hiện tại `PARTIALLY_PAID`, không cho đổi về `UNPAID`.

**Ngoại lệ:**
- 400 nếu vi phạm ràng buộc trạng thái hoặc dữ liệu sai.
- 403 nếu không đủ quyền.
- 404 nếu không tồn tại.

**Postcondition:**
- Hóa đơn được cập nhật; các trường Decimal128 và `payments` nhất quán.

---

## Nhóm Use Case: Payment (Thanh toán)

### Tên Use Case: Tạo giao dịch VNPay
**Actor**: User (optionalAuth), có thể không đăng nhập
**Mô tả**: Tạo `Payment` PENDING và nhận URL redirect sang VNPay.
**Precondition**: `billId` tồn tại; `amount` > 0 và ≤ số dư hóa đơn.

**Luồng chính:**
1. `POST /api/payment/vnpay/create` với `{ billId, amount, bankCode? }` và optional token.
2. Tạo `Payment` trạng thái `PENDING` với `transactionId` (UUID).
3. Build VNPay URL và trả `{ url }` cho client redirect.

**Ngoại lệ:**
- 400 nếu số tiền không hợp lệ hoặc provider không hỗ trợ.
- 404 nếu bill không tồn tại.

**Postcondition:**
- Bản ghi `Payment` PENDING được lưu; client điều hướng sang VNPay.

---

### Tên Use Case: Xử lý VNPay Return (trình duyệt)
**Actor**: Hệ thống
**Mô tả**: Xác minh checksum; nếu thành công, áp dụng thanh toán và redirect về frontend.
**Precondition**: VNPay trả về tham số hợp lệ.

**Luồng chính:**
1. `GET /api/payment/vnpay/return` đọc query VNPay.
2. Xác minh checksum; tìm `Payment` theo `transactionId`.
3. Nếu `rspCode === '00'`, gọi `applyPaymentToBill` (idempotent) và redirect về `FRONTEND_SUCCESS_URL` kèm query.
4. Nếu không, đánh dấu `FAILED` và trả thông báo.

**Ngoại lệ:**
- 400 nếu checksum sai.
- 404 nếu không tìm thấy `Payment`.
- 500 nếu lỗi áp dụng thanh toán.

**Postcondition:**
- Bill cập nhật `amountPaid/status`; Payment `SUCCESS/FAILED`.

---

### Tên Use Case: Xử lý VNPay IPN (server callback)
**Actor**: Hệ thống
**Mô tả**: Nguồn chân lý cập nhật thanh toán.
**Precondition**: IPN gửi đúng checksum.

**Luồng chính:**
1. `POST /api/payment/vnpay/ipn` (urlencoded).
2. Xác minh checksum và tìm/khởi tạo `Payment` nếu cần (idempotent).
3. Nếu `rspCode === '00'`, gọi `applyPaymentToBill`, trả `{ RspCode: '00' }`.
4. Nếu thất bại, đánh dấu `FAILED` và trả mã lỗi tương ứng.

**Ngoại lệ:**
- 97 nếu checksum sai.
- 01 nếu không tìm thấy Payment.
- 500 nếu lỗi nội bộ.

**Postcondition:**
- Bill và Payment phản ánh trạng thái chính xác.

---

### Tên Use Case: Tạo giao dịch MoMo
**Actor**: User (có thể không đăng nhập)
**Mô tả**: Tạo `Payment` PENDING, gọi API MoMo để lấy `payUrl`.
**Precondition**: `billId` tồn tại; số tiền > 0; bill chưa `PAID`.

**Luồng chính:**
1. `POST /api/payment/momo/create`.
2. Validate bill/contract/room/tenant; tạo Payment PENDING.
3. Ký HMAC và gửi request tới MoMo; trả `payUrl` và thông tin đơn.

**Ngoại lệ:**
- 400 nếu dữ liệu thiếu/không hợp lệ.
- 404 nếu bill/chuỗi liên quan không tồn tại.
- 500 lỗi máy chủ/https.

**Postcondition:**
- Payment PENDING; người dùng redirect.

---

### Tên Use Case: MoMo Return (trình duyệt)
**Actor**: Hệ thống
**Mô tả**: Lưu metadata; cố gắng áp dụng thanh toán nếu chưa `SUCCESS`.
**Precondition**: Callback với tham số đầy đủ.

**Luồng chính:**
1. `GET /api/payment/momo/return` xác minh chữ ký (nếu có).
2. Lưu `metadata.returnData`; nếu `resultCode === 0`, gọi `applyPaymentToBill` (idempotent).
3. Trả trang HTML thông báo thành công/thất bại.

**Ngoại lệ:**
- 500 nếu lỗi nội bộ.

**Postcondition:**
- Bill/Payment cập nhật tương ứng.

---

### Tên Use Case: MoMo IPN (server)
**Actor**: Hệ thống
**Mô tả**: Xác minh chữ ký; tạo/tìm Payment; áp dụng thanh toán.
**Precondition**: IPN hợp lệ.

**Luồng chính:**
1. `POST /api/payment/momo/ipn` (JSON).
2. Xác minh chữ ký; parse `extraData` lấy `billId`.
3. Tìm/tạo Payment idempotent; nếu `resultCode === 0`, gọi `applyPaymentToBill`.
4. Trả `{ resultCode: 0, message: 'Confirm Success' }` khi thành công.

**Ngoại lệ:**
- 400 nếu chữ ký sai.
- 99 nếu lỗi nội bộ.

**Postcondition:**
- Trạng thái thanh toán được cập nhật chính xác.

---

### Tên Use Case: Tạo giao dịch ZaloPay
**Actor**: User
**Mô tả**: Tạo order ZaloPay và Payment PENDING.
**Precondition**: `billId` tồn tại; bill chưa `PAID`.

**Luồng chính:**
1. `POST /api/payment/zalopay/create`.
2. Build order (MAC ký), gọi endpoint tạo; lưu Payment PENDING.
3. Trả `payUrl` và data ZaloPay.

**Ngoại lệ:**
- 400 nếu thiếu `billId` hoặc bill đã thanh toán.
- 500 nếu lỗi API ZaloPay.

**Postcondition:**
- Payment PENDING được lưu.

---

### Tên Use Case: ZaloPay Callback (IPN)
**Actor**: Hệ thống
**Mô tả**: Xác minh MAC; idempotent; áp dụng thanh toán.
**Precondition**: Callback hợp lệ từ ZaloPay.

**Luồng chính:**
1. `POST /api/payment/zalopay/callback` (urlencoded `data`, `mac`).
2. Xác minh MAC; tìm Payment theo `app_trans_id`.
3. Nếu `return_code === 1`, gọi `applyPaymentToBill` và trả `{ return_code: 1 }`.
4. Ngược lại, set `FAILED` và trả mã tương ứng.

**Ngoại lệ:**
- MAC sai: `{ return_code: -1 }`.
- 99 nếu lỗi nội bộ.

**Postcondition:**
- Bill/Payment cập nhật trạng thái.

---

## Nhóm Use Case: Tenant

### Tên Use Case: Tạo tenant (Public)
**Actor**: Public/User
**Mô tả**: Khách tạo hồ sơ người thuê khi đặt phòng.
**Precondition**: Body hợp lệ theo Joi.

**Luồng chính:**
1. `POST /api/tennant`.
2. Lưu `Tenant` mới và trả 201.

**Ngoại lệ:**
- 500 nếu lỗi server.

**Postcondition:**
- Tenant mới được tạo.

---

### Tên Use Case: Xem tenant của tôi
**Actor**: User (đã đăng nhập)
**Mô tả**: Xem danh sách tenant thuộc về mình.
**Precondition**: JWT Tenant.

**Luồng chính:**
1. `GET /api/tennant/my-tenant`.
2. Trả danh sách tenant.

**Ngoại lệ:**
- 401 nếu thiếu token.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Xem tenant theo ID (Public có auth)
**Actor**: User
**Mô tả**: Lấy tenant theo ID.
**Precondition**: JWT; `id` hợp lệ.

**Luồng chính:**
1. `GET /api/tennant/public/:id`.
2. Trả 200 với dữ liệu.

**Ngoại lệ:**
- 404 nếu không tồn tại.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Quản lý tenant (Admin/) – Xem/Sửa/Xóa
**Actor**: Admin
**Mô tả**: CRUD (trong code: tạo public; admin có xem/sửa/xóa).
**Precondition**: JWT; params/body hợp lệ.

**Luồng chính:**
1. Xem danh sách: `GET /api/tennant`.
2. Xem chi tiết: `GET /api/tennant/:id`.
3. Sửa: `PUT /api/tennant/:id`.
4. Xóa: `DELETE /api/tennant/:id`.

**Ngoại lệ:**
- 403 nếu không đủ quyền.
- 404 nếu không tồn tại.

**Postcondition:**
- Tenant được cập nhật/xóa.

---

## Nhóm Use Case: Complaints (Khiếu nại)

### Tên Use Case: Tạo khiếu nại (Public đã đăng nhập)
**Actor**: User
**Mô tả**: Gửi khiếu nại liên quan đến dịch vụ.
**Precondition**: JWT; body hợp lệ (`title` ≥ 3, `description` ≥ 10).

**Luồng chính:**
1. `POST /api/complaints/`.
2. Validate và tạo `Complaint` với `createdBy = req.user._id`.
3. Trả 201 với dữ liệu.

**Ngoại lệ:**
- 400 nếu dữ liệu không hợp lệ.
- 500 lỗi server.

**Postcondition:**
- Complaint ở trạng thái `PENDING`.

---

### Tên Use Case: Xem khiếu nại theo Tenant
**Actor**: User
**Mô tả**: Xem danh sách khiếu nại của một tenant.
**Precondition**: JWT; `tenantId` hợp lệ.

**Luồng chính:**
1. `GET /api/complaints/tenant/:tenantId` với phân trang.
2. Trả danh sách complaint và pagination.

**Ngoại lệ:**
- 500 nếu lỗi server.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Xem khiếu nại của tôi
**Actor**: User
**Mô tả**: Xem complaint của bản thân.
**Precondition**: JWT.

**Luồng chính:**
1. `GET /api/complaints/:id`.

**Ngoại lệ:**
- 404 nếu complaint không tồn tại.

**Postcondition:**
- Không xóa khiếu nại theo chính sách.

---

### Tên Use Case: Quản trị khiếu nại (Admin)
**Actor**: Admin
**Mô tả**: Xem tất cả, cập nhật trạng thái.
**Precondition**: JWT Admin.

**Luồng chính:**
1. Ping: `GET /api/admin/complaints/_ping`.
2. Xem danh sách: `GET /api/admin/complaints/`.
3. Cập nhật trạng thái: `PUT /api/admin/complaints/:id/status` với các ràng buộc:
   - Nếu `RESOLVED` rồi, không cho chuyển về trạng thái khác.
   - Nếu đang `IN_PROGRESS`, không cho quay về `PENDING`.
4. Không xóa khiếu nại; có thể đóng trạng thái `CLOSED` khi đã xử lý xong.

**Ngoại lệ:**
- 403 nếu không phải Admin.
- 400 nếu chuyển trạng thái không hợp lệ.

**Postcondition:**
- Trạng thái complaint: `PENDING` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`. Không xóa complaint.
- Complaint cập nhật theo thao tác quản trị.

---

## Nhóm Use Case: Utility (Thiết bị/tiện ích phòng)

### Tên Use Case: Quản lý Utility (Admin/) – Xem/Tạo/Sửa/Xóa
**Actor**: Admin
**Mô tả**: CRUD utility và các filter.
**Precondition**: JWT Admin/.

**Luồng chính:**
1. Xem danh sách: `GET /api/utils` với filter `name`, `condition`, `room`, `isActive`, `page`, `limit`.
2. Xem chi tiết: `GET /api/utils/:id`.
3. Tạo: `POST /api/utils`.
4. Sửa: `PUT /api/utils/:id`.
5. Xóa (soft delete): `DELETE /api/utils/:id` → set `isActive = false`.

**Ngoại lệ:**
- 400 nếu ID không hợp lệ hoặc `room` không hợp lệ.
- 404 nếu không tồn tại.
- 500 lỗi server.

**Postcondition:**
- Utility được cập nhật/ẩn thay vì xóa cứng.

---

### Tên Use Case: Lấy Utility theo phòng
**Actor**: Admin
**Mô tả**: Xem danh sách utility đang active của một phòng.
**Precondition**: JWT; `roomId` hợp lệ.

**Luồng chính:**
1. `GET /api/rooms/:roomId/utils`.
2. Trả danh sách utility.

**Ngoại lệ:**
- 400 nếu `roomId` không hợp lệ.
- 500 nếu lỗi.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Lấy Utility bị hỏng
**Actor**: Admin
**Mô tả**: Xem danh sách utility condition = `broken`.
**Precondition**: JWT.

**Luồng chính:**
1. `GET /api/utils/broken` với phân trang.
2. Trả danh sách.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Cập nhật condition của Utility
**Actor**: Admin
**Mô tả**: Cập nhật trạng thái `condition` (`new`, `used`, `broken`).
**Precondition**: JWT; `id` hợp lệ; body `{ condition }` thuộc tập cho phép.

**Luồng chính:**
1. `PATCH /api/utils/:id/condition`.
2. Validate và gọi `util.updateCondition(condition)`.
3. Trả 200 với dữ liệu cập nhật.

**Ngoại lệ:**
- 400 nếu `id`/`condition` không hợp lệ.
- 404 nếu không tồn tại.

**Postcondition:**
- Utility được đổi trạng thái.

---

## Nhóm Use Case: Utility Fee (Cấu hình phí tiện ích)

### Tên Use Case: Quản lý Utility Fee (Admin/)
**Actor**: Admin
**Mô tả**: CRUD cấu hình phí tiện ích & tính điện độc lập.
**Precondition**: JWT Admin/.

**Luồng chính:**
1. Xem danh sách: `GET /api/fees` với filter `type`, `isActive`, phân trang.
2. Xem chi tiết: `GET /api/fees/:id`.
3. Tạo: `POST /api/fees` (nếu tạo `isActive = true`, hệ thống tự `deactivate` config đang active cùng type).
4. Sửa: `PUT /api/fees/:id` (nếu bật `isActive`, deactivate active cùng type).
5. Xóa: `DELETE /api/fees/:id` → set `isActive = false`.
6. Tính tiền điện: `POST /api/fees/electricity/calculate` với `{ kwh }` sử dụng cấu hình active hoặc default.

**Ngoại lệ:**
- 400 nếu ID/kwh không hợp lệ.
- 404 nếu không tìm thấy fee.

**Postcondition:**
- Cấu hình phí được cập nhật; kết quả tính điện trả về theo tiers + VAT.

---

## Nhóm Use Case: Room Fee (gán phí cho phòng)

### Tên Use Case: Gán phí cho phòng
**Actor**: Admin
**Mô tả**: Chọn các loại phí áp dụng cho phòng và snapshot config hiện hành.
**Precondition**: JWT; `roomId` hợp lệ.

**Luồng chính:**
1. `POST /api/rooms/:roomId/fees` với `{ appliedTypes: [...] }`.
2. Deactivate assignment cũ; snapshot refs của fee active theo từng loại.
3. Trả 201 với dữ liệu.

**Ngoại lệ:**
- 400 nếu `roomId` không hợp lệ.
- 404 nếu phòng không tồn tại.

**Postcondition:**
- Phòng có bản ghi RoomFee active mới.

---

### Tên Use Case: Lấy phí hiện tại của phòng
**Actor**: Admin
**Mô tả**: Xem cấu hình phí áp dụng.
**Precondition**: JWT; `roomId` hợp lệ.

**Luồng chính:**
1. `GET /api/rooms/:roomId/fees`.
2. Trả dữ liệu RoomFee active.

**Ngoại lệ:**
- 404 nếu chưa gán phí.

**Postcondition:**
- Không thay đổi dữ liệu.

---

### Tên Use Case: Tính phí phòng theo đầu vào
**Actor**: Admin
**Mô tả**: Tính tổng phí dựa trên `kwh`, `occupantCount` theo loại phí đã gán.
**Precondition**: JWT; `roomId` hợp lệ; đã có RoomFee active.

**Luồng chính:**
1. `POST /api/rooms/:roomId/fees/calculate` với `{ kwh, occupantCount }`.
2. Áp dụng cấu hình active: điện (tiers+VAT), nước/internet (flat), vệ sinh/đỗ xe (theo số người).
3. Trả breakdown và tổng.

**Ngoại lệ:**
- 404 nếu phòng chưa gán phí.
- 400 nếu `roomId` không hợp lệ.

**Postcondition:**
- Không thay đổi dữ liệu.

---

## Nhóm Use Case: Check-in tiền mặt (Public)

### Tên Use Case: Quy trình Check-in & Ký hợp đồng (ONLINE/OFFLINE)
**Actor**: Admin/User
**Mô tả**: Quy trình nghiệp vụ đầy đủ từ check-in đến kích hoạt Tenant.
**Precondition**: JWT; dữ liệu phòng/hợp đồng hợp lệ.

**Luồng chính:**
1. Admin tạo check-in tạm.
2. Hệ thống sinh `bill_receipt` (tiền cọc).
3. User thanh toán online (VNPay/MoMo/Zalo) hoặc Admin duyệt offline → hóa đơn `PAID`.
4. In hợp đồng mẫu.
5. User ký → Admin scan và upload hợp đồng final (chỉ Admin).
6. Hệ thống sinh `bill_contract`.
7. Thanh toán `bill_contract` (online/offline).
8. Admin kích hoạt tài khoản Tenant.
9. Hệ thống sinh hóa đơn hàng tháng (`bill_monthly`).

**Ngoại lệ:**
- 400 nếu thiếu trường yêu cầu.
- 404 nếu phòng/hợp đồng không tồn tại.
- 401 nếu chưa đăng nhập.

**Postcondition:**
- Contract/Bill được tạo theo từng bước; tài khoản Tenant được kích hoạt sau `bill_contract = PAID`.

---

## Nhóm Use Case: Log (Nhật ký hệ thống)

### Tên Use Case: Quản lý Log (Admin)
**Actor**: Admin
**Mô tả**: CRUD log, thống kê và dọn dẹp.
**Precondition**: JWT Admin.

**Luồng chính:**
1. Tạo log: `POST /api/logs`.
2. Xem danh sách: `GET /api/logs` với filter/pagination.
3. Xem thống kê: `GET /api/logs/stats` theo `level`/`entity`/`actor`.
4. Dọn dẹp logs cũ: `GET /api/logs/cleanup?days=...&level?=...`.
5. Xem/sửa/xóa theo ID: `GET/PUT/DELETE /api/logs/:id`.
6. Xem theo entity: `GET /api/logs/entity/:entity/:entityId`.

**Ngoại lệ:**
- 403 nếu không phải Admin.
- 400/500 tùy lỗi.

**Postcondition:**
- Logs được lưu/cập nhật; TTL tự xóa sau 180 ngày.

---

## Yêu cầu Validation & Lỗi chung

- Mọi `params` ObjectId phải hợp lệ (Joi hoặc kiểm tra mongoose) – lỗi 400.
- `validatePagination` cho `page`/`limit` – giới hạn `limit ≤ 100`.
- Lỗi JWT: 401 cho token không hợp lệ/hết hạn.
- Lỗi Multer upload: `LIMIT_FILE_SIZE`, `LIMIT_FILE_COUNT`, `LIMIT_UNEXPECTED_FILE` trả 400 với thông điệp rõ ràng.
- Lỗi Mongoose: `ValidationError` trả 400; `11000` (trùng khóa) trả 400; `CastError` trả 400.
- Rate limit đơn giản có thể cấu hình (không bật mặc định trong routes).

---

## Ghi chú Kiến trúc & Trạng thái

- Tất cả tiền tệ sử dụng `Decimal128` trong DB; controller format về số khi trả ra API.
- Trạng thái `Bill`: `UNPAID` → `PARTIALLY_PAID` → `PAID` → `CLOSED` (không cho lùi trạng thái sau khi đã thanh toán; offline do Admin duyệt).
- `FinalContract` trạng thái: `DRAFT` → `WAITING_SIGN` → `SIGNED` tùy mốc `tenantSignedAt` và `ownerApprovedAt`.
- `Complaint` trạng thái: `PENDING` → `IN_PROGRESS` → `RESOLVED` với ràng buộc chuyển trạng thái.
- `RoomFee`/`UtilityFee` chỉ có một cấu hình `isActive` cho mỗi loại tại một thời điểm.

---

## Ma trận Phân quyền (RBAC)

- Admin:
  - Toàn quyền: quản lý người dùng, phòng, hợp đồng, hóa đơn, tiện ích, phí, khiếu nại, báo cáo, nhật ký.
  - Thực hiện quy trình check-in; upload hợp đồng final; kích hoạt tài khoản Tenant.
  - Duyệt thanh toán offline, đóng hóa đơn (`CLOSED`).
- User (Tenant):
  - Xem/tải hợp đồng, hóa đơn, biên lai; thanh toán online; gửi khiếu nại; đổi mật khẩu.
  - Chỉ truy cập tài nguyên của mình; không thể xóa hợp đồng/hóa đơn/khiếu nại.

---

## Phân nhóm Endpoints theo Module (Tham chiếu nhanh)

- Auth: `/api/register`, `/api/login`, `/api/reset-password`.
- User: `/api/users`, `/api/users/:id` (Public/optionalAuth xem hạn chế); CRUD Admin.
- Room Public: `/api/rooms/public`, `/api/rooms/public/:id`.
- Room Admin: `/api/rooms`, `/api/rooms/:id`, ảnh: `/api/rooms/:id/images/:publicId`, `/api/rooms/:id/cover`.
- Contract Public: `/api/contracts/my-contracts`, `/api/contracts/public/:id`.
- Contract Admin: `/api/contracts`, `/api/contracts/:id` (Xem/Tạo/Sửa; không xóa theo chính sách).
- Final Contract Public/Protected: `POST /api/final-contracts`, `GET /api/final-contracts/public/:id`, `GET /api/final-contracts/public/:id/files/:index/view`, `POST /api/final-contracts/:id/upload`, `POST /api/final-contracts/:id/upload-cccd`, `PUT /api/final-contracts/:id/approve`, `GET /api/final-contracts/:id/remaining`.
- Bill Public: `/api/bills/my-bills`, `/api/bills/public/:id`.
- Bill Admin: `/api/bills`, `/api/bills/:id` (Xem/Tạo/Sửa; không dùng DELETE theo chính sách).
- Payment: VNPay `/api/payment/vnpay/create`, `/api/payment/vnpay/return`, `/api/payment/vnpay/ipn`; MoMo `/api/payment/momo/create`, `/api/payment/momo/return`, `/api/payment/momo/ipn`; ZaloPay `/api/payment/zalopay/create`, `/api/payment/zalopay/callback`, `/api/payment/zalopay/return`.
- Tenant Public: `/api/tennant`, `/api/tennant/my-tenant`, `/api/tennant/public/:id`.
- Tenant Admin: `/api/tennant` (GET), `/api/tennant/:id` (GET/PUT/DELETE).
- Complaints Public: `/api/complaints/`, `/api/complaints/tenant/:tenantId`, `/api/complaints/:id` (GET/DELETE).
- Complaints Admin: `/api/admin/complaints/`, `/_ping`, `/:id/status` (không xóa theo chính sách).
- Util: `/api/utils`, `/api/utils/:id`, `/api/rooms/:roomId/utils`, `/api/utils/broken`, `/api/utils/:id/condition`.
- Utility Fee: `/api/fees`, `/api/fees/:id`, `/api/fees/electricity/calculate`.
- Room Fee: `/api/rooms/:roomId/fees`, `/api/rooms/:roomId/fees/calculate`.
- Checkin Public: `/api/checkin/cash`.
- Log (Admin): `/api/logs`, `/api/logs/stats`, `/api/logs/cleanup`, `/api/logs/:id`, `/api/logs/entity/:entity/:entityId`.