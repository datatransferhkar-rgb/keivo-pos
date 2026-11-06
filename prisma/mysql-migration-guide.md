# Panduan Migrasi Database: SQLite (Development) ke MySQL (Production)

Dokumen ini menjelaskan prosedur perpindahan database dari **SQLite** (`dev.db`) yang digunakan selama proses pengembangan lokal ke **MySQL** saat sistem dideploy ke server staging/production.

---

## 1. Perbedaan Lingkungan

| Lingkungan | Database Engine | Connection String (`DATABASE_URL`) | File Skema Prisma |
| :--- | :--- | :--- | :--- |
| **Development** (Lokal) | SQLite | `file:./dev.db` | `prisma/schema.prisma` |
| **Production** (Server) | MySQL (v8.0+ / MariaDB 10.5+) | `mysql://user:pass@host:3306/keivo_pos` | `prisma/schema.mysql.prisma` |

---

## 2. Langkah-Langkah Migrasi ke MySQL

### Langkah 1: Siapkan Database MySQL di Server
Buat database baru pada server MySQL Anda:
```sql
CREATE DATABASE keivo_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Langkah 2: Sesuaikan File `.env`
Ubah baris `DATABASE_URL` di file `.env` di server Anda:
```env
# Contoh koneksi MySQL di Server Production
DATABASE_URL="mysql://keivo_admin:PasswordAman123!@127.0.0.1:3306/keivo_pos?charset=utf8mb4"
```

### Langkah 3: Terapkan Skema ke Database MySQL
Jalankan perintah sinkronisasi skema MySQL berikut:
```bash
npx prisma db push --schema=prisma/schema.mysql.prisma
```
Atau jika ingin menggunakan skema utama, ganti `provider = "sqlite"` menjadi `provider = "mysql"` di `prisma/schema.prisma`, lalu jalankan:
```bash
npx prisma db push
```

### Langkah 4: Generate Prisma Client
Pastikan Prisma Client ter-regenerate dengan provider MySQL:
```bash
npx prisma generate --schema=prisma/schema.mysql.prisma
```

### Langkah 5: Seed Data Awal (Opsional)
Jalankan script seed untuk memasukkan 20 Meja Restoran (Meja 01 s/d Meja 20), kategori menu nusantara, akun kasir/admin, dan pengaturan default restoran:
```bash
npx tsx prisma/seed.ts
```

---

## 3. Catatan Integritas Data & Rupiah
- Seluruh nilai nominal Rupiah (`price`, `subtotal`, `totalAmount`, `amountPaid`, `floatAmount`) disimpan dalam tipe data `Int` (bukan Float) untuk mencegah error pembulatan desimal.
- Pengaturan identitas restoran (Nama Restoran, Logo, Alamat, No. Telp, Footer Struk) disimpan dalam tabel `restaurant_settings` dengan ID unik `default` dan dapat diubah secara dinamis melalui UI Kasir POS tanpa perlu restart server.
