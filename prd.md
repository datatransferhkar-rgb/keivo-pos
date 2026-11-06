# PRD — Aplikasi POS Restoran dengan QR Ordering

- **Nama proyek:** Restaurant POS & QR Ordering
- **Versi:** 1.1
- **Status:** Draft untuk implementasi MVP
- **Bahasa antarmuka:** Bahasa Indonesia
- **Zona waktu default:** Asia/Jakarta
- **Mata uang:** IDR (Rupiah)
- **Target platform:** Web responsif untuk ponsel, tablet, dan desktop

---

## 1. Ringkasan Produk

Bangun aplikasi POS (Point of Sale) untuk restoran yang mendukung tiga sumber pesanan: pelanggan memesan sendiri melalui QR code di meja, pelanggan walk-in memesan take away langsung di kasir, serta pesanan dari platform online eksternal yang diinput kasir dengan mencatat platform dan ID pesanan eksternal. Pelanggan QR melihat katalog digital, memilih makanan dan jumlah, mengisi nama pemesan, lalu mengirim pesanan.

Pesanan yang sama harus terlihat oleh kasir dan kitchen. Kasir mencetak daftar pesanan untuk ditempel di meja, kitchen memproses pesanan, dan pramusaji bekerja secara fisik: mengambil daftar pesanan dari kasir, menempelkannya di meja pemesan, lalu memastikan hidangan yang datang sesuai dengan daftar tersebut. Pramusaji tidak memiliki akun, panel, atau akses langsung ke sistem. Setelah pelanggan selesai makan, kasir membuka tagihan berdasarkan nomor meja atau nama pemesan, menerima pembayaran, dan mencetak kwitansi.

Aplikasi harus memiliki satu sumber data utama agar status pesanan, penyajian, dan pembayaran tetap konsisten di seluruh layar.

## 2. Tujuan Produk

1. Memudahkan pelanggan memesan sendiri melalui QR code tanpa menginstal aplikasi.
2. Mengurangi kesalahan pencatatan pesanan dan komunikasi antara kasir, kitchen, dan pramusaji.
3. Memberikan kitchen daftar pesanan yang jelas berdasarkan nomor meja dan waktu masuk.
4. Membantu pramusaji mencocokkan hidangan secara fisik dengan daftar pesanan cetak tanpa perlu mengakses sistem.
5. Memungkinkan kasir menemukan tagihan dengan cepat, menerima pembayaran, dan mencetak kwitansi.
6. Mengelola sesi/shift kasir, merangkum transaksi per shift, dan memisahkan uang kas kecil yang dibawa ke shift berikutnya dari pendapatan penjualan.
7. Menyediakan data transaksi yang dapat ditinjau oleh pemilik atau administrator.

### Indikator keberhasilan MVP

- Pelanggan dapat mengirim pesanan dari halaman QR tanpa membuat akun.
- Pesanan yang dikirim muncul di panel kasir dan kitchen.
- Setiap item dapat dilacak dari dipesan sampai siap diantar; penyajian akhir diverifikasi secara fisik menggunakan daftar cetak.
- Tagihan dihitung dari item yang benar dan harga saat pemesanan.
- Transaksi yang sudah dibayar tidak dapat dibayar dua kali secara tidak sengaja.
- Daftar pesanan dan kwitansi dapat dicetak melalui fungsi cetak browser.
- Aplikasi dapat digunakan pada layar ponsel dan desktop.

## 3. Pengguna dan Hak Akses

### 3.1 Customer (tanpa login)

- Membuka katalog dari QR code meja.
- Mengisi nama pemesan.
- Melihat kategori, foto, deskripsi, harga, dan ketersediaan menu.
- Memilih jumlah, catatan, dan opsi tambahan jika tersedia.
- Melihat ringkasan pesanan sebelum mengirim.
- Mengirim pesanan dan melihat nomor pesanan serta statusnya.
- Menambahkan pesanan berikutnya ke sesi meja yang masih aktif, bila fitur ini diaktifkan.

Pelanggan tidak boleh mengubah harga, mengubah status pembayaran, atau melihat data pelanggan/meja lain.

### 3.2 Kasir

- Login dengan memilih nama kasir dari daftar kasir aktif dan memasukkan password pribadi.
- Memulai satu sesi/shift kasir setelah autentikasi berhasil; sistem mencatat waktu mulai dan saldo kas awal yang ada di laci kasir.
- Melihat pesanan baru dan daftar tagihan aktif.
- Membuat pesanan take away untuk pelanggan walk-in yang datang langsung ke kasir.
- Menginput pesanan yang diterima dari platform online eksternal dengan memilih nama platform, memasukkan ID pesanan eksternal, nama pelanggan bila tersedia, item, jumlah, catatan, serta status pembayaran sesuai informasi dari platform.
- Memilih kanal pesanan secara eksplisit: `Dine-in QR`, `Takeaway Walk-in`, atau `Online Platform`.
- Mencatat nama platform (misalnya nama marketplace/pesan-antar yang benar-benar digunakan restoran) dan ID pesanan eksternal untuk pesanan online.
- Mencegah ID pesanan eksternal yang sama diinput dua kali pada platform yang sama.
- Mencari transaksi dengan nomor meja, nama pemesan, atau nomor pesanan.
- Membuka detail item, kuantitas, catatan, subtotal, pajak/biaya (jika diaktifkan), diskon (jika diizinkan), dan total.
- Mencetak daftar pesanan untuk ditempel di meja.
- Mencatat pembayaran dengan metode **Tunai**, **QR code statis**, atau **Transfer bank**.
- Untuk pembayaran QR statis, menampilkan gambar QR pembayaran yang dikonfigurasi admin pada layar kasir agar pelanggan dapat memindainya; kasir tetap mengonfirmasi pembayaran berdasarkan bukti yang diterima, karena MVP tidak memverifikasi pembayaran secara otomatis.
- Memasukkan jumlah uang yang diterima untuk pembayaran tunai dan melihat kembalian.
- Menutup sesi/shift dengan melihat rincian transaksi dan mencetak laporan transaksi shift.
- Mencatat saldo kas akhir yang benar-benar dihitung. Sistem membedakan uang kas awal/kas kecil yang dibawa ke shift berikutnya dari pendapatan penjualan.
- Melihat status pembayaran dan riwayat transaksi sesuai hak akses.

Kasir tidak boleh menghapus transaksi yang sudah dibayar. Pembatalan atau pengembalian dana harus memiliki alur terpisah dan tercatat.

### 3.3 Kitchen

- Melihat pesanan masuk secara langsung atau melalui penyegaran otomatis.
- Melihat nomor meja, nama pemesan, waktu pesanan, item, jumlah, dan catatan.
- Mengubah status item/pesanan menjadi `Diproses` dan `Siap diantar`.
- Melihat pesanan aktif tanpa perlu mengakses informasi pembayaran yang sensitif.
- Mencetak tiket kitchen jika printer tersedia.

### 3.4 Pramusaji (tanpa akses sistem)

- Tidak memiliki akun login, panel, atau akses langsung ke aplikasi.
- Mengambil daftar pesanan cetak dari kasir dan menempelkannya di meja pemesan.
- Memastikan makanan yang diantarkan kitchen sesuai dengan item dan jumlah pada daftar cetak.
- Menyampaikan ketidaksesuaian kepada kasir atau kitchen secara langsung.
- Tidak mengubah status pesanan di aplikasi; daftar cetak dan komunikasi dengan kasir/kitchen menjadi prosedur operasionalnya.

### 3.5 Admin/Pemilik

- Mengelola menu, kategori, harga, foto, dan ketersediaan menu.
- Mengelola nomor meja dan membuat/mencetak QR code tiap meja.
- Mengelola akun staf dan peran.
- Mengatur nama restoran, alamat, nomor telepon, teks kwitansi, pajak, biaya layanan, dan metode pembayaran.
- Melihat transaksi dan laporan sederhana.
- Melakukan pembatalan dengan alasan dan jejak audit sesuai izin.

## 4. Ruang Lingkup

### 4.1 Termasuk dalam MVP

- Login kasir dengan memilih nama dari daftar kasir aktif dan memasukkan password; login admin dan kitchen mengikuti pengaturan akses staf.
- Pencatatan sesi/shift kasir, saldo kas awal dan akhir, rincian transaksi per sesi, serta laporan shift siap cetak.
- Tiga kanal pesanan: dine-in melalui QR meja, take away walk-in yang dibuat kasir, dan pesanan platform online yang diinput manual oleh kasir.
- Katalog menu publik melalui QR code meja.
- Keranjang dan pengiriman pesanan pelanggan.
- Panel kasir.
- Panel kitchen.
- Tidak ada panel atau akun pramusaji; proses pramusaji menggunakan daftar pesanan cetak.
- Manajemen meja dan QR code.
- Manajemen menu dan kategori.
- Pelacakan status pesanan, item, penyajian, dan pembayaran.
- Dukungan kanal pesanan: QR meja/dine-in, walk-in take away, dan platform online eksternal.
- Input manual pesanan take away dan pesanan platform online oleh kasir.
- Pencatatan nama platform online dan ID pesanan eksternal yang unik per platform.
- Cetak daftar pesanan dan kwitansi melalui browser.
- Riwayat transaksi, laporan penjualan dasar, dan laporan transaksi per sesi/shift kasir.
- Metode pembayaran tunai, QR code statis yang dapat ditampilkan di layar kasir, dan transfer bank.
- Pencatatan saldo kas kecil yang dibawa dari satu shift ke shift berikutnya, terpisah dari penjualan.
- Antarmuka responsif dan berbahasa Indonesia.

### 4.2 Tidak termasuk dalam MVP (dapat dibuat kemudian)

- Pembayaran online otomatis melalui payment gateway.
- Integrasi printer thermal langsung melalui perangkat keras atau protokol khusus.
- Manajemen inventori bahan baku dan resep.
- Program loyalitas, poin, voucher kompleks, dan promosi bertingkat.
- Pesanan delivery atau integrasi kurir.
- Multi-cabang dan konsolidasi laporan antarcabang.
- Integrasi akuntansi, pajak elektronik, atau sistem pihak ketiga.
- Aplikasi native iOS/Android.

**Catatan cetak:** MVP menggunakan halaman cetak yang kompatibel dengan dialog print browser (`window.print`) dan CSS khusus cetak. Pencetakan otomatis tanpa dialog dan pemilihan printer thermal tertentu membutuhkan integrasi tambahan.

## 5. Alur Bisnis Utama

### 5.1 Pelanggan memesan melalui QR meja (dine-in)

1. Admin membuat meja, misalnya `Meja 05`, dan sistem menghasilkan QR code unik.
2. Pelanggan memindai QR code dan membuka URL yang terikat pada meja tersebut.
3. Halaman menampilkan nama restoran dan nomor meja yang terdeteksi.
4. Pelanggan memasukkan nama pemesan.
5. Pelanggan memilih menu, kuantitas, dan catatan item.
6. Pelanggan memeriksa keranjang dan total perkiraan.
7. Pelanggan menekan **Kirim Pesanan** dan mengonfirmasi.
8. Sistem membuat nomor pesanan unik, menyimpan harga saat transaksi, dan menghubungkan pesanan ke sesi meja aktif.
9. Pesanan muncul pada panel kasir dan kitchen.
10. Sistem menampilkan konfirmasi agar pelanggan tidak mengirim pesanan yang sama berulang kali karena jaringan lambat.

### 5.2 Pesanan take away dari pelanggan walk-in

1. Pelanggan datang langsung ke kasir dan menyampaikan pesanan take away.
2. Kasir memilih **Buat Pesanan** lalu kanal `Takeaway Walk-in`.
3. Kasir memasukkan nama pelanggan (jika tersedia), item, kuantitas, dan catatan.
4. Sistem membuat nomor pesanan internal tanpa mewajibkan nomor meja atau sesi meja.
5. Pesanan dikirim ke antrean kitchen dan dapat dicetak sebagai tiket/daftar pesanan.
6. Kasir dapat mencatat pembayaran di awal atau sesuai alur operasional restoran. Status pembayaran harus terpisah dari status persiapan makanan.
7. Pesanan take away dapat ditandai selesai/diserahkan kepada pelanggan melalui status pemenuhan yang sesuai.

### 5.3 Pesanan dari platform online eksternal

1. Kasir menerima pesanan dari platform online yang digunakan restoran.
2. Kasir memilih **Buat Pesanan** lalu kanal `Online Platform`.
3. Kasir memilih nama platform dan memasukkan ID pesanan dari platform tersebut. ID eksternal wajib untuk kanal ini.
4. Kasir memasukkan nama pelanggan jika tersedia, rincian item, kuantitas, catatan, serta informasi pembayaran yang terlihat pada platform.
5. Sistem menyimpan ID pesanan eksternal dan menghubungkan pesanan dengan antrean kitchen.
6. Sistem menolak duplikasi kombinasi nama platform + ID pesanan eksternal.
7. Sistem tidak menganggap pesanan sudah dibayar hanya karena berasal dari platform online. Kasir harus memilih status/metode pembayaran berdasarkan informasi yang benar-benar tersedia, misalnya dibayar melalui platform atau dibayar saat serah terima.
8. Pesanan tetap dikelola oleh sistem internal untuk persiapan, pencetakan tiket, dan pelacakan status. MVP tidak mengambil pesanan otomatis dari platform; input dilakukan manual oleh kasir.

### 5.4 Kasir dan pencetakan daftar pesanan

1. Kasir membuka panel pesanan baru.
2. Kasir dapat melihat meja, nama pemesan, nomor pesanan, waktu, item, kuantitas, dan catatan.
3. Kasir mencetak daftar pesanan yang akan ditempel di meja.
4. Setiap cetakan menampilkan nomor meja dan nama pemesan dengan jelas.
5. Jika pelanggan mengirim pesanan tambahan, sistem membuat batch/nomor pesanan tambahan di sesi meja yang sama. Cetakan tambahan harus diberi label **PESANAN TAMBAHAN** beserta waktu dan nomor pesanan.
6. Cetak ulang diperbolehkan, tetapi tidak membuat transaksi atau pesanan baru.

### 5.5 Kitchen menyiapkan makanan

1. Pesanan baru muncul pada layar kitchen dengan penanda waktu masuk.
2. Kitchen melihat item, jumlah, dan catatan khusus.
3. Kitchen memulai proses dan mengubah status item menjadi `Diproses`.
4. Setelah siap, kitchen mengubah status item menjadi `Siap diantar`.
5. Perubahan status tercermin pada panel kasir agar kasir dapat mencetak daftar pesanan untuk pramusaji.
6. Item yang siap tetap terlihat pada panel kitchen/kasir sampai ditangani sesuai prosedur operasional; pramusaji tidak mengubah status di aplikasi.

### 5.6 Pramusaji mengantarkan makanan

1. Kasir melihat item berstatus `Siap diantar` dan mencetak daftar pesanan yang diperlukan.
2. Pramusaji mengambil daftar pesanan dari kasir dan menempelkannya di meja pemesan.
3. Pramusaji mencocokkan setiap hidangan yang datang dengan nama item dan jumlah pada daftar.
4. Jika ada item atau jumlah yang tidak sesuai, pramusaji mengonfirmasi langsung kepada kitchen/kasir sebelum mengantarkannya.
5. Pramusaji tidak menekan tombol atau mengubah status di sistem. Dalam MVP, status digital berhenti pada status kitchen `Siap diantar`; daftar cetak menjadi alat bantu operasional, bukan bukti digital bahwa makanan telah sampai di meja.

### 5.7 Pembayaran

1. Setelah pelanggan selesai makan, kasir mencari berdasarkan nomor meja, nama pemesan, atau nomor pesanan.
2. Sistem menampilkan sesi meja dan semua pesanan yang termasuk dalam sesi tersebut, termasuk pesanan tambahan.
3. Kasir memeriksa item, kuantitas, harga satuan, subtotal, pajak/biaya layanan (jika diaktifkan), diskon (jika diizinkan), dan total akhir.
4. Kasir memilih metode pembayaran: tunai, QR code statis, atau transfer bank.
5. Untuk tunai, kasir memasukkan jumlah uang diterima dan sistem menghitung kembalian. Untuk QR statis atau transfer, kasir memeriksa bukti pembayaran lalu mengonfirmasi secara manual.
6. Kasir mengonfirmasi pembayaran.
7. Sistem menyimpan transaksi pembayaran dengan referensi unik dan mengubah status tagihan menjadi `Lunas` hanya jika total yang harus dibayar telah terpenuhi.
8. Kasir mencetak kwitansi yang memuat nomor transaksi, waktu, meja, nama pemesan, rincian item, total, metode pembayaran, jumlah dibayar, dan kembalian jika ada.
9. Setelah pembayaran lunas, sesi meja ditutup dan meja dapat digunakan untuk sesi baru.

### 5.8 Login dan sesi/shift kasir

1. Kasir memilih namanya dari daftar kasir aktif pada halaman login dan memasukkan password pribadinya.
2. Setelah autentikasi berhasil, kasir memulai sesi shift baru. Sistem mencatat kasir, waktu mulai, dan saldo kas awal yang dihitung secara fisik di laci kasir.
3. Jika shift sebelumnya menyisakan uang kas di laci, saldo tersebut menjadi saldo kas awal shift berikutnya. Saldo bawaan/kas kecil bukan penjualan dan tidak boleh masuk ke total pendapatan.
4. Semua pembayaran dan tindakan kasir selama shift dicatat dengan `cashier_session_id`.
5. Saat shift berakhir, kasir meninjau detail transaksi, total penjualan menurut metode pembayaran, saldo kas awal, pemasukan/pengeluaran kas yang tercatat, dan saldo kas akhir hasil hitung fisik.
6. Sistem menghitung saldo kas yang seharusnya ada di laci berdasarkan saldo awal, pembayaran tunai, pengeluaran/pemasukan kas yang dicatat, dan pengembalian tunai. Selisih dengan hitung fisik ditampilkan untuk ditinjau.
7. Kasir menutup shift dan dapat mencetak laporan transaksi shift. Setelah ditutup, sesi tidak dapat diedit biasa; koreksi memerlukan izin dan audit.
8. Saldo kas akhir yang ditetapkan sebagai kas yang tetap disimpan di laci menjadi saldo awal sesi berikutnya. Kas bawaan tidak dihitung sebagai omzet; hanya transaksi penjualan yang sah yang dihitung sebagai penjualan.

## 6. Aturan Bisnis Penting

- **QR code terikat ke meja, bukan ke tagihan permanen.** Setiap kunjungan membentuk sesi meja baru. QR meja yang sama dapat digunakan kembali untuk sesi berikutnya.
- **Nama pemesan wajib diisi** sebelum pesanan dikirim.
- **Harga transaksi disimpan sebagai snapshot.** Perubahan harga menu di kemudian hari tidak mengubah pesanan lama.
- **Pesanan tambahan** pada meja yang sama selama sesi aktif ditautkan ke sesi yang sama, tetapi tetap memiliki nomor pesanan/batch dan waktu tersendiri.
- **Jangan menggandakan pesanan.** Pengiriman harus memiliki mekanisme idempotensi atau perlindungan terhadap klik berulang dan retry jaringan.
- **Status order dan status item dibedakan.** Satu pesanan dapat memiliki beberapa item dengan status berbeda.
- **Tidak ada status digital `Sudah dihidangkan` dalam MVP.** Pramusaji tidak memiliki akses sistem; daftar cetak digunakan untuk mencocokkan hidangan secara fisik.
- **Tagihan dihitung di server**, bukan mempercayai total dari browser pelanggan.
- **Pembayaran tidak boleh tercatat dua kali** akibat klik ganda atau permintaan ulang.
- **Metode pembayaran MVP:** tunai, QR code statis, dan transfer bank. QR statis ditampilkan dari gambar/asset yang dikonfigurasi admin; konfirmasi pembayaran dilakukan manual, bukan melalui payment gateway.
- **Saldo kas awal/kas kecil bukan penjualan.** Uang yang tersimpan di laci dari shift sebelumnya dicatat sebagai saldo bawaan dan tidak boleh menambah omzet.
- **Setiap transaksi kasir terikat pada satu sesi shift.** Sesi yang sudah ditutup bersifat read-only kecuali koreksi berizin yang tercatat.
- **Uang kas dan penjualan harus dipisahkan.** Saldo laci terdiri dari saldo awal, penerimaan/pengeluaran kas, dan kembalian; laporan penjualan hanya menghitung transaksi penjualan yang lunas.
- **Pesanan yang sudah dibayar tidak boleh diedit langsung.** Koreksi dilakukan lewat pembatalan/pengembalian dana dengan alasan dan audit trail.
- **Item yang dibatalkan** harus memiliki alasan, staf yang melakukan pembatalan, waktu, dan aturan apakah item tersebut masuk tagihan.
- **Meja tidak boleh ditutup** jika masih ada saldo yang belum dibayar, kecuali admin melakukan tindakan khusus yang tercatat.
- **Pajak, biaya layanan, dan diskon** dapat dinonaktifkan atau diatur oleh admin. Nilai default MVP adalah 0 sampai dikonfigurasi.
- Semua waktu transaksi disimpan dalam format timestamp yang konsisten dan ditampilkan dalam zona waktu `Asia/Jakarta`.

## 7. Status Data

### 7.1 Status item pesanan

Gunakan transisi yang jelas:

`Baru` → `Diproses` → `Siap diantar`

Status alternatif `Dibatalkan` dapat diterapkan jika diizinkan dan wajib menyimpan alasan. Dalam MVP, status digital item berhenti pada `Siap diantar` karena pramusaji tidak memiliki akses ke sistem untuk menandai penyajian akhir.

### 7.2 Status pesanan/batch

- `Baru`: telah dikirim oleh pelanggan.
- `Diterima`: tercatat dan tersedia untuk diproses.
- `Diproses`: satu atau lebih item sedang disiapkan.
- `Siap diantar`: seluruh item aktif dalam batch sudah siap dari kitchen.
- `Dibatalkan`: semua item dibatalkan dengan alasan.

MVP tidak mencatat status digital setelah makanan diambil/diantar oleh pramusaji.

Status pesanan merupakan ringkasan dari status item; jangan sampai status ringkasan menimpa status item yang lebih rinci.

### 7.3 Status sesi meja/tagihan

- `Aktif`: sesi meja menerima pesanan.
- `Menunggu pembayaran`: pelanggan selesai memesan atau kasir mulai proses tagihan.
- `Lunas`: seluruh total tagihan sudah dibayar.
- `Ditutup`: sesi telah ditutup dan meja siap digunakan kembali.
- `Dibatalkan`: sesi dibatalkan melalui proses berizin.

### 7.4 Status pembayaran

- `Belum dibayar`
- `Sebagian` (jika pembayaran parsial diaktifkan)
- `Lunas`
- `Dikembalikan sebagian` (fitur lanjutan)
- `Dikembalikan penuh` (fitur lanjutan)
- `Dibatalkan` (untuk pembayaran yang belum berhasil diselesaikan)

Untuk MVP, pembayaran parsial dapat dinonaktifkan. Jika dinonaktifkan, hanya pembayaran penuh yang diperbolehkan.

## 8. Kebutuhan Fungsional

### FR-01 — QR code dan meja

- Admin dapat membuat, mengubah nama/nomor, mengaktifkan, dan menonaktifkan meja.
- Setiap meja memiliki ID unik dan token QR acak yang tidak mudah ditebak.
- Sistem menyediakan halaman untuk melihat dan mencetak QR code.
- URL QR mengarahkan ke halaman katalog dengan konteks meja.
- Meja nonaktif tidak dapat menerima pesanan baru.
- Sistem tidak boleh mengandalkan nomor meja dari parameter URL yang dapat diubah tanpa validasi server.

### FR-02 — Katalog menu

- Menu memiliki nama, deskripsi, kategori, foto opsional, harga, status tersedia/tidak tersedia, dan urutan tampil.
- Pelanggan dapat memfilter menu berdasarkan kategori.
- Menu yang tidak tersedia terlihat sebagai tidak tersedia dan tidak dapat ditambahkan ke keranjang.
- Foto yang gagal dimuat menampilkan placeholder.
- Harga ditampilkan dalam format Rupiah, misalnya `Rp25.000`.

### FR-03 — Keranjang dan pemesanan

- Pelanggan dapat menambah/mengurangi jumlah item dan menghapus item dari keranjang.
- Kuantitas harus bilangan bulat positif dan dibatasi dengan nilai maksimum yang masuk akal.
- Pelanggan dapat menambahkan catatan per item.
- Nama pemesan wajib diisi.
- Pelanggan melihat ringkasan dan total sebelum mengirim.
- Server memvalidasi harga dan ketersediaan terbaru ketika pesanan dikirim.
- Setelah berhasil, tampilkan nomor pesanan dan status.
- Jika pengiriman gagal, keranjang tidak boleh hilang tanpa pemberitahuan.
- Sistem mencegah klik ganda menghasilkan pesanan ganda.

### FR-04 — Panel kasir dan sesi shift

- Dashboard menampilkan pesanan baru, pesanan aktif, dan tagihan yang belum lunas.
- Login kasir mengharuskan pemilihan nama kasir aktif dan password yang sesuai; password tetap diverifikasi dengan aman dan tidak boleh disimpan dalam bentuk teks biasa.
- Kasir harus membuka sesi shift sebelum mencatat pembayaran atau menjalankan tindakan yang perlu dikaitkan dengan shift.
- Saat membuka shift, sistem meminta saldo kas awal fisik. Default-nya adalah saldo kas akhir shift sebelumnya yang tetap disimpan di laci; kasir mengonfirmasi atau mencatat selisih sesuai izin.
- Semua pembayaran dan transaksi yang dilakukan kasir selama shift ditautkan ke sesi tersebut.
- Kasir dapat membuat pesanan baru dengan memilih kanal `Takeaway Walk-in` atau `Online Platform`.
- Untuk take away, kasir memasukkan item, jumlah, catatan, dan nama pelanggan opsional.
- Untuk online platform, kasir wajib memilih platform dan memasukkan ID pesanan eksternal, lalu memasukkan item dan detail yang tersedia.
- Sistem menolak duplikasi ID eksternal pada platform yang sama.
- Kasir dapat menandai status pembayaran berdasarkan bukti/informasi dari sumber pesanan; sistem tidak menganggap pesanan online otomatis lunas.
- Kasir dapat mencari berdasarkan nomor meja, nama pemesan, nomor pesanan, atau nomor transaksi.
- Detail menampilkan waktu, item, jumlah, catatan, status item, dan total.
- Kasir dapat mencetak daftar pesanan per batch atau ringkasan seluruh sesi meja.
- Kasir dapat membuka tagihan dari sesi meja yang aktif.
- Kasir dapat mencatat pembayaran dan mencetak kwitansi.
- Sistem menampilkan peringatan jika ada item dibatalkan atau tagihan berubah sebelum pembayaran dikonfirmasi.
- Kasir dapat melihat rincian seluruh transaksi pada shift aktif dan riwayat shift yang telah ditutup sesuai hak akses.
- Pada akhir shift, kasir dapat melihat dan mencetak laporan yang memuat waktu mulai/selesai, kasir, daftar transaksi, total per metode pembayaran, saldo kas awal, pergerakan kas, saldo kas yang diharapkan, saldo fisik yang dihitung, serta selisih.
- Saldo kas awal dan kas kecil bawaan ditampilkan terpisah dari omzet dan tidak dijumlahkan sebagai penjualan.
- Pembayaran QR statis menampilkan QR yang dikonfigurasi admin. Pembayaran transfer mencatat referensi transfer opsional; keduanya memerlukan konfirmasi manual.

### FR-05 — Panel kitchen

- Menampilkan antrean pesanan baru dan aktif.
- Urutkan secara default berdasarkan waktu pesanan masuk, yang paling lama lebih dahulu.
- Setiap kartu pesanan menampilkan kanal/sumber pesanan, nomor meja jika dine-in, nama pemesan jika tersedia, nomor pesanan internal, ID eksternal jika ada, waktu masuk, item, jumlah, dan catatan.
- Kitchen dapat mengubah status item sesuai transisi yang diizinkan.
- Pembaruan terlihat pada panel lain tanpa perlu logout/login.
- Pesanan selesai dapat dipindahkan ke riwayat agar antrean aktif tetap ringkas.

### FR-06 — Daftar pesanan cetak untuk pramusaji

- Tidak dibuat panel, akun, atau rute aplikasi untuk pramusaji.
- Kasir dapat mencetak daftar pesanan yang memuat nomor meja, nama pemesan, nomor pesanan, waktu, item, jumlah, catatan, serta penanda status kitchen yang relevan.
- Daftar cetak dibuat agar dapat ditempel di meja dan dipakai pramusaji untuk mencocokkan hidangan.
- Ketidaksesuaian hidangan ditangani melalui komunikasi langsung dengan kasir/kitchen; tidak ada aksi digital `Sudah dihidangkan` oleh pramusaji.

### FR-07 — Pembayaran dan kwitansi

- Kasir melihat semua pesanan yang terhubung ke sesi meja aktif.
- Total dihitung dari item yang tidak dibatalkan dan harga snapshot.
- Dukungan metode pembayaran `cash`, `static_qr`, dan `bank_transfer`.
- Untuk `static_qr`, tampilkan gambar QR statis yang dikelola admin pada layar pembayaran kasir; tidak ada verifikasi otomatis atau payment gateway pada MVP.
- Untuk `bank_transfer`, kasir dapat mencatat nomor referensi transfer opsional dan mengonfirmasi pembayaran secara manual setelah memeriksa bukti.
- Pembayaran non-tunai tidak dianggap berhasil hanya karena metode dipilih; kasir harus mengonfirmasi setelah memeriksa bukti pembayaran.
- Untuk tunai, jumlah diterima harus sama dengan atau lebih besar dari total yang harus dibayar.
- Kembalian dihitung otomatis.
- Simpan nomor transaksi unik, waktu, kasir, metode, total, jumlah diterima, dan kembalian.
- Kwitansi memiliki tampilan cetak yang ringkas dan terbaca.
- Cetak ulang kwitansi tidak membuat pembayaran baru dan diberi label `SALINAN` jika sesuai pengaturan.
- Transaksi yang sudah lunas tidak dapat dibayar lagi.

### FR-08 — Manajemen menu dan konfigurasi

- Admin dapat melakukan CRUD kategori dan menu.
- Admin dapat mengubah harga dan status ketersediaan.
- Admin dapat mengatur identitas restoran dan informasi pada kwitansi.
- Admin dapat mengatur pajak dan biaya layanan dalam bentuk persentase atau nominal sesuai kebutuhan implementasi; nilai dan cara pembulatan harus konsisten.
- Semua perubahan konfigurasi yang memengaruhi transaksi baru tidak boleh mengubah transaksi lama.

### FR-09 — Laporan penjualan dan laporan shift kasir

- Ringkasan penjualan berdasarkan rentang tanggal.
- Jumlah transaksi lunas dan total pendapatan.
- Penjualan per menu dan jumlah terjual.
- Filter tanggal.
- Setiap sesi shift memiliki daftar transaksi lengkap, subtotal/total per metode pembayaran, waktu transaksi, nomor transaksi, dan status.
- Kasir dapat melihat dan mencetak laporan shift miliknya setelah shift ditutup.
- Admin/pemilik dapat melihat laporan seluruh kasir sesuai hak akses.
- Laporan shift memisahkan omzet penjualan dari saldo kas awal, kas kecil bawaan, setoran/pengeluaran kas, dan saldo kas akhir.
- Hanya transaksi penjualan lunas yang dihitung sebagai penjualan; saldo kas awal bukan pendapatan. Pengembalian dana, jika kelak didukung, ditampilkan terpisah.

### FR-10 — Pengguna dan audit

- Kasir login dengan memilih nama kasir dari daftar kasir aktif dan memasukkan password; sistem tetap memvalidasi password terhadap hash yang tersimpan.
- Admin dan kitchen memiliki autentikasi sesuai peran. Pramusaji tidak memiliki akun atau akses sistem.
- Hak akses diterapkan di sisi server, bukan hanya menyembunyikan tombol di UI.
- Satu kasir tidak boleh memiliki dua sesi shift terbuka bersamaan, kecuali kebijakan admin secara eksplisit mengizinkan.
- Simpan `created_by`, `updated_by`, dan timestamp untuk perubahan penting.
- Perubahan status, pembatalan, pembayaran, dan cetak ulang penting dapat dilacak.
- Kata sandi disimpan menggunakan mekanisme hashing yang aman dari framework/auth provider yang dipilih.

## 9. Halaman dan Navigasi

### Publik / Customer

1. `/menu/:tableToken` — katalog meja.
2. `/cart` atau panel keranjang — item yang dipilih.
3. `/order/confirmation/:orderId` — konfirmasi pesanan.
4. Halaman/komponen status pesanan yang menunjukkan kanal dan nomor pesanan tanpa membocorkan data pelanggan lain.
4. `/order/status/:orderId` — status pesanan (opsional dalam MVP).

### Staf

1. `/login` — halaman login; kasir memilih nama dan memasukkan password.
2. `/cashier` — dashboard kasir.
3. `/cashier/orders/:orderId` — detail pesanan.
4. `/cashier/orders/new` — input pesanan take away atau pesanan online eksternal.
5. `/cashier/online-platforms` — konfigurasi daftar platform online yang didukung (bisa menjadi bagian pengaturan admin).
6. `/cashier/tables/:tableId` — sesi meja dan tagihan.
7. `/cashier/session` — buka/tutup shift dan pengelolaan saldo kas.
8. `/cashier/session/report` — detail transaksi dan laporan shift siap cetak.
9. `/cashier/payments/:paymentId/receipt` — kwitansi siap cetak.
10. `/kitchen` — antrean kitchen.
11. `/admin/menu` — pengelolaan menu.
12. `/admin/categories` — kategori.
13. `/admin/tables` — meja dan QR code.
14. `/admin/users` — akun staf.
15. `/admin/settings` — pengaturan restoran termasuk QR pembayaran statis dan instruksi transfer.
16. `/admin/reports` — laporan penjualan dan shift seluruh kasir.

Rute di atas merupakan usulan; implementasi boleh menyesuaikan struktur framework selama pemisahan akses dan alur tetap terjaga.

## 10. Struktur Data yang Disarankan

Gunakan database relasional. Nama tabel berikut adalah rancangan awal dan boleh disesuaikan dengan konvensi framework.

### `users`

- `id`
- `name`
- `username` (unik; dapat digunakan sebagai identitas login)
- `password_hash`
- `role` (`admin`, `cashier`, `kitchen`)
- `is_active`
- `created_at`, `updated_at`

Pramusaji tidak dibuat sebagai user karena tidak memiliki akses ke aplikasi. Pada login kasir, nama ditampilkan sebagai pilihan, tetapi autentikasi tetap mensyaratkan password pribadi.

### `dining_tables`

- `id`
- `table_number` (unik)
- `display_name`
- `qr_token` (unik, acak)
- `is_active`
- `created_at`, `updated_at`

### `table_sessions`

Mewakili satu kunjungan/penggunaan meja. Meja yang sama dapat memiliki sesi berbeda sepanjang hari.

- `id`
- `session_number` (unik dan mudah dibaca)
- `table_id`
- `customer_name`
- `status`
- `opened_at`
- `closed_at` (nullable)
- `created_at`, `updated_at`

### `categories`

- `id`
- `name`
- `description` (nullable)
- `sort_order`
- `is_active`
- `created_at`, `updated_at`

### `menu_items`

- `id`
- `category_id`
- `name`
- `description`
- `image_url` (nullable)
- `price` (integer dalam Rupiah, bukan floating point)
- `is_available`
- `sort_order`
- `created_at`, `updated_at`

### `orders`

Setiap pengiriman pelanggan menjadi satu order/batch.

- `id`
- `order_number` (unik, mudah dibaca)
- `table_session_id` (nullable untuk take away/online; wajib untuk dine-in QR)
- `order_type` (misalnya `initial` atau `additional`)
- `source_channel` (`dine_in_qr`, `takeaway_walk_in`, `online_platform`)
- `fulfillment_type` (`dine_in`, `takeaway`, `delivery_platform`)
- `external_platform_id` (nullable; relasi ke platform)
- `external_order_id` (nullable; ID dari platform online)
- `customer_name` (nullable untuk kanal yang tidak menyediakan nama)
- `status`
- `notes` (nullable)
- `submitted_at`
- `created_at`, `updated_at`
- `idempotency_key` (unik untuk mencegah duplikasi)

### `order_items`

- `id`
- `order_id`
- `menu_item_id`
- `item_name_snapshot`
- `unit_price_snapshot`
- `quantity`
- `line_total`
- `customer_note` (nullable)
- `kitchen_status`
- `cancel_reason` (nullable)
- `cancelled_by` (nullable)
- `cancelled_at` (nullable)
- `prepared_at` (nullable)
- `ready_at` (nullable)
- `created_at`, `updated_at`

### `online_platforms`

Daftar platform eksternal yang dapat dipilih kasir.

- `id`
- `name` (unik, misalnya nama platform pesan-antar yang digunakan restoran)
- `is_active`
- `created_at`, `updated_at`

Tambahkan unique constraint pada kombinasi `external_platform_id + external_order_id` untuk pesanan dengan kanal `online_platform`. Perilaku unique constraint untuk nilai NULL berbeda antar database, sehingga pastikan aturan ini diuji di SQLite dan MySQL.

### `payments`

- `id`
- `payment_number` (unik)
- `table_session_id` (nullable jika pembayaran untuk takeaway/online)
- `order_id` atau relasi tagihan yang dibayar sesuai model implementasi
- `amount_due`
- `amount_paid`
- `change_amount`
- `method` (`cash`, `static_qr`, `bank_transfer`)
- `status`
- `transfer_reference` (nullable)
- `cashier_id`
- `cashier_session_id`
- `paid_at`
- `created_at`

Jika pembayaran parsial dinonaktifkan, satu pembayaran sukses melunasi seluruh tagihan. Tetap gunakan transaksi database untuk mencegah dua kasir melunasi tagihan yang sama secara bersamaan.

### `cashier_sessions`

Mencatat satu sesi/shift kerja kasir.

- `id`
- `session_number` (unik)
- `cashier_id`
- `started_at`
- `ended_at` (nullable)
- `opening_cash_amount` (saldo kas fisik saat shift dimulai; integer Rupiah)
- `expected_closing_cash_amount` (saldo laci yang dihitung sistem)
- `counted_closing_cash_amount` (saldo kas fisik saat shift ditutup)
- `cash_difference_amount` (selisih hitung fisik dengan saldo yang diharapkan)
- `status` (`open`, `closed`)
- `closing_notes` (nullable)
- `created_at`, `updated_at`

Tambahkan constraint/validasi agar satu kasir hanya memiliki satu sesi terbuka pada satu waktu.

### `cash_movements`

Mencatat pergerakan uang laci yang bukan transaksi penjualan, misalnya pengeluaran kas kecil atau penambahan uang kas.

- `id`
- `cashier_session_id`
- `movement_type` (`cash_in`, `cash_out`, `carry_forward`)
- `amount` (integer Rupiah, positif)
- `reason`
- `created_by`
- `created_at`

`opening_cash_amount` pada `cashier_sessions` menjadi saldo awal resmi sesi. Jangan menghitung saldo awal dua kali dengan membuat pergerakan kas tambahan untuk jumlah yang sama. Pergerakan kas kecil bawaan/antarshift dicatat sebagai pergerakan non-penjualan bila diperlukan untuk audit, bukan sebagai payment atau order, sehingga tidak pernah masuk ke omzet.

### `restaurant_settings`

- `id`
- `restaurant_name`
- `address`
- `phone`
- `receipt_footer`
- `static_qr_image_url` (nullable; gambar QR pembayaran statis yang dikonfigurasi admin)
- `static_qr_label` (nullable; misalnya nama penerima/penyedia QR)
- `bank_transfer_instructions` (nullable; instruksi rekening untuk transfer)
- `tax_enabled`
- `tax_rate`
- `service_charge_enabled`
- `service_charge_rate`
- `currency` (default `IDR`)
- `timezone` (default `Asia/Jakarta`)

### `audit_logs`

- `id`
- `user_id`
- `action`
- `entity_type`
- `entity_id`
- `details` (JSON)
- `created_at`

### Relasi inti

- Satu meja memiliki banyak sesi meja.
- Satu sesi meja memiliki banyak order.
- Satu order memiliki banyak order item.
- Order dine-in QR terhubung ke sesi meja; order take away dan online tidak wajib memiliki sesi meja.
- Satu platform online memiliki banyak order eksternal.
- Satu sesi meja memiliki satu atau lebih catatan pembayaran, sesuai kebijakan pembayaran.
- Satu kategori memiliki banyak menu.
- Satu staf dapat melakukan banyak aksi yang dicatat dalam audit log.
- Satu kasir memiliki banyak sesi shift; satu sesi shift mencakup banyak pembayaran dan pergerakan kas.
- Saldo akhir shift yang ditetapkan untuk tetap berada di laci menjadi saldo awal shift berikutnya, tanpa membuat transaksi penjualan.

## 11. Persyaratan UI/UX

### Gaya umum

- Tampilan bersih, modern, ramah restoran, dan mudah dipahami staf.
- Gunakan Bahasa Indonesia untuk seluruh label, status, validasi, dan pesan error.
- Gunakan format mata uang `Rp25.000`.
- Status harus menggunakan teks dan indikator visual, bukan warna saja.
- Tombol utama mudah dijangkau pada layar sentuh.
- Konfirmasi untuk tindakan penting seperti kirim pesanan, batalkan item, dan konfirmasi pembayaran.
- Tampilkan loading, empty state, error state, dan feedback sukses.
- Jangan mengandalkan hover saja untuk aksi penting.

### Customer

- Utamakan tampilan mobile.
- Kartu menu menampilkan foto (jika ada), nama, deskripsi singkat, harga, ketersediaan, dan tombol tambah.
- Keranjang mudah dibuka tanpa kehilangan pilihan.
- Ringkasan pesanan jelas sebelum dikirim.
- Nomor meja harus terlihat sepanjang proses.
- Jangan meminta pelanggan membuat akun.

### Kasir

- Optimalkan untuk desktop/tablet.
- Login kasir menampilkan daftar nama kasir aktif dan kolom password; jangan menampilkan password atau membocorkan apakah password tertentu benar.
- Setelah login, tampilkan status shift: belum dibuka, sedang berjalan, atau siap ditutup.
- Saat membuka shift, tampilkan saldo kas awal bawaan dari shift sebelumnya untuk dikonfirmasi.
- Gunakan tabel atau daftar dengan pencarian dan filter.
- Bedakan pesanan baru, aktif, siap diantar, belum lunas, dan lunas.
- Total tagihan dan tombol pembayaran harus jelas.
- Hindari aksi pembayaran ganda melalui disable tombol saat proses berlangsung.

### Kitchen

- Gunakan kartu besar dan teks mudah dibaca dari jarak kerja.
- Nomor meja, waktu masuk, jumlah item, dan catatan harus menonjol.
- Sediakan tombol besar untuk memperbarui status.
- Urutkan antrean berdasarkan waktu masuk.

### Pramusaji

- Tidak ada antarmuka aplikasi untuk pramusaji.
- Daftar pesanan cetak harus jelas, mudah dibaca, dan sesuai untuk ditempel di meja.
- Nomor meja, nama pemesan, item, kuantitas, dan catatan harus mudah dicocokkan dengan hidangan fisik.

### Cetak

Buat template cetak khusus untuk:
1. **Daftar pesanan meja:** nama restoran, nomor meja, nama pemesan, nomor pesanan, waktu, item, kuantitas, catatan, dan status.
2. **Tiket kitchen:** nomor meja, waktu, item, kuantitas, dan catatan khusus.
3. **Kwitansi:** identitas restoran, nomor transaksi, tanggal/waktu, kasir, meja, nama pemesan, rincian item, subtotal, pajak/biaya/diskon, total, metode pembayaran, jumlah dibayar, kembalian, dan footer.

Gunakan CSS `@media print` untuk menyembunyikan navigasi dan tombol serta menjaga tata letak tetap ringkas. Jangan menyatakan integrasi printer thermal telah tersedia jika hanya menggunakan dialog cetak browser.

## 12. Persyaratan Nonfungsional

- **Keamanan:** validasi input di server, otorisasi per role, proteksi endpoint, dan pengamanan token QR.
- **Audit kas:** perubahan saldo kas, pembukaan/penutupan shift, dan selisih kas harus memiliki catatan audit yang tidak dapat dihapus kasir.
- **Konsistensi:** perhitungan tagihan dan pencatatan pembayaran harus dijalankan secara atomik dalam transaksi database.
- **Reliabilitas:** tampilkan error jika pesanan atau pembayaran gagal; jangan menampilkan sukses palsu.
- **Performa:** halaman menu dan dashboard umum harus terasa responsif pada koneksi internet restoran yang normal.
- **Pembaruan data:** gunakan realtime jika didukung stack; jika tidak, polling berkala dengan indikator pembaruan.
- **Responsif:** dukung layar ponsel, tablet, dan desktop.
- **Aksesibilitas:** label input jelas, kontras memadai, navigasi keyboard dasar, dan status tidak hanya dibedakan dengan warna.
- **Privasi:** customer tidak dapat membuka detail order pelanggan lain hanya dengan menebak ID; gunakan token akses yang aman jika halaman status publik disediakan.
- **Backup:** dokumentasikan cara backup dan restore database.
- **Observabilitas:** error penting dicatat tanpa membocorkan kata sandi, token, atau data rahasia ke log.

## 13. Keamanan dan Integritas Transaksi

- Semua endpoint staf harus memverifikasi sesi login dan role.
- Validasi bahwa meja aktif dan token QR benar sebelum menerima order.
- Validasi harga dan ketersediaan menu di server.
- Gunakan ID internal yang tidak mudah ditebak untuk otorisasi; UUID tidak menggantikan pemeriksaan izin.
- Jangan mempercayai nilai total, harga, role, atau status yang dikirim dari browser.
- Pembayaran harus menggunakan transaksi database dan pemeriksaan status tagihan terkini.
- Gunakan unique constraint untuk nomor order, nomor pembayaran, token QR, dan idempotency key.
- Terapkan pembatasan akses dan rate limiting yang wajar untuk endpoint publik.
- Jangan simpan data kartu pembayaran. Untuk MVP, metode non-tunai hanya dicatat setelah staf mengonfirmasi penerimaan pembayaran di luar aplikasi.
- Semua aksi pembatalan, perubahan status penting, dan pembayaran harus mencatat pelaku dan waktunya.

## 14. Acceptance Criteria

### AC-01 — QR dan katalog

- Diberikan meja aktif, ketika QR dipindai, halaman menu terbuka dan menampilkan meja yang benar.
- Diberikan meja nonaktif, pelanggan tidak dapat mengirim pesanan baru.
- Menu yang tidak tersedia tidak dapat ditambahkan atau dikirim.

### AC-02 — Kirim pesanan

- Diberikan keranjang valid dan nama pelanggan, ketika pelanggan mengirim pesanan, sistem membuat satu nomor pesanan dan menampilkannya.
- Klik berulang atau retry jaringan tidak membuat pesanan duplikat.
- Pesanan yang sama terlihat di kasir dan kitchen.

### AC-03 — Kanal take away dan online

- Kasir dapat membuat pesanan take away tanpa memilih nomor meja.
- Pesanan take away muncul di antrean kitchen dan memiliki nomor pesanan internal.
- Kasir dapat memasukkan pesanan online dengan platform dan ID eksternal.
- Kombinasi platform + ID eksternal yang sama ditolak sebagai duplikat.
- Pesanan dari platform online tidak otomatis dianggap lunas tanpa status pembayaran yang dikonfirmasi kasir.

### AC-04 — Cetak pesanan

- Kasir dapat membuka pratinjau cetak dan mencetak daftar pesanan dengan nomor meja, nama, item, jumlah, catatan, serta waktu.
- Cetak ulang tidak membuat order baru.
- Pesanan tambahan ditampilkan sebagai batch tambahan.

### AC-05 — Kitchen dan prosedur pramusaji

- Kitchen dapat mengubah item dari `Baru` menjadi `Diproses`, lalu `Siap diantar`.
- Kasir dapat melihat item yang siap dan mencetak daftar pesanan untuk ditempel di meja.
- Tidak ada akun, panel, atau endpoint pramusaji untuk mengubah status.
- Daftar cetak memuat item dan kuantitas sehingga pramusaji dapat mencocokkan hidangan secara fisik.

### AC-06 — Pembayaran

- Kasir dapat menemukan sesi berdasarkan nomor meja atau nama pemesan.
- Semua order dalam sesi aktif dihitung ke dalam tagihan dengan mengecualikan item yang dibatalkan.
- Sistem menghitung total dari data server dan harga snapshot.
- Untuk pembayaran tunai, sistem menghitung kembalian dengan benar.
- Kasir dapat memilih tunai, QR code statis, atau transfer bank.
- Metode QR statis menampilkan gambar QR yang dikonfigurasi admin; QR/transfer hanya dicatat lunas setelah kasir mengonfirmasi bukti pembayaran.
- Dua permintaan pembayaran bersamaan tidak dapat melunasi tagihan yang sama dua kali.
- Setelah pembayaran berhasil, status tagihan menjadi `Lunas` dan kwitansi dapat dicetak.
- Cetak ulang kwitansi tidak menambah transaksi pembayaran.

### AC-07 — Role dan keamanan

- Customer tidak dapat membuka panel staf.
- Kitchen tidak dapat mencatat pembayaran.
- Tidak ada role, akun, rute, atau panel pramusaji; daftar pesanan pramusaji hanya berupa hasil cetak dari kasir.
- Kasir tidak dapat mengubah konfigurasi admin kecuali diberi izin khusus.
- Aksi terlarang ditolak oleh server meskipun endpoint dipanggil langsung.

### AC-08 — Sesi shift dan kas kecil

- Kasir harus memilih nama dan memasukkan password yang benar sebelum dapat membuka shift.
- Setiap pembayaran selama shift ditautkan ke sesi kasir yang aktif.
- Saat shift dimulai, saldo kas yang tersisa dari shift sebelumnya menjadi saldo awal shift baru.
- Saldo kas awal/kas kecil tidak masuk ke total penjualan atau omzet.
- Kasir dapat melihat detail transaksi dan mencetak laporan setelah shift ditutup.
- Laporan menampilkan saldo kas awal, total pembayaran tunai, pergerakan kas, saldo yang diharapkan, saldo fisik, dan selisih.
- Sistem menolak penutupan shift tanpa prosedur konfirmasi saldo akhir, kecuali ada override berizin yang tercatat.

### AC-08 — UI dan error

- Seluruh alur inti dapat digunakan pada ponsel dan desktop.
- Loading, kosong, sukses, dan error ditampilkan secara jelas.
- Jika server gagal menyimpan order atau pembayaran, UI tidak menampilkan status berhasil.
- Format Rupiah dan waktu konsisten.

## 15. Rekomendasi Arsitektur untuk Antigravity

Gunakan stack yang sederhana, terdokumentasi, dan mudah dijalankan oleh agen coding. Jika belum ada stack yang ditentukan, gunakan rekomendasi awal berikut sebagai default, bukan keharusan:

- **Frontend:** Next.js dengan TypeScript dan komponen UI responsif.
- **Backend:** server-side actions/API di aplikasi yang sama, dengan validasi server.
- **Database development lokal:** SQLite.
- **Database target saat migrasi/deployment:** MySQL.
- **Akses database/ORM:** pilih satu ORM yang mendukung SQLite dan MySQL, misalnya Prisma atau Drizzle, setelah memverifikasi dukungan fitur dan migrasinya.
- **Migrasi database:** siapkan skema dan strategi migrasi terpisah untuk SQLite dan MySQL; jangan mengasumsikan file migrasi SQL SQLite dapat langsung dijalankan di MySQL.
- **Autentikasi:** solusi autentikasi yang mendukung session dan role-based access untuk admin, kasir, dan kitchen.
- **Realtime:** Supabase Realtime, WebSocket, atau polling terjadwal sebagai fallback.
- **Penyimpanan foto menu:** object storage atau layanan penyimpanan yang sesuai.
- **Cetak:** halaman HTML dengan CSS print dan dialog cetak browser.
- **QR code:** pustaka QR code tepercaya yang menghasilkan URL meja.

### Catatan kompatibilitas SQLite → MySQL

- SQLite digunakan untuk pengembangan lokal; MySQL adalah target deployment/migrasi.
- Gunakan tipe data dan constraint yang kompatibel dengan kedua database. Hindari ketergantungan pada perilaku khusus SQLite.
- Gunakan integer untuk nominal Rupiah; hindari floating point untuk perhitungan uang.
- Tetapkan strategi ID, timestamp, indeks, foreign key, dan unique constraint yang valid pada kedua database.
- Uji perilaku transaksi, unique constraint, nilai NULL, kolom JSON, dan perbandingan string di kedua engine.
- Jangan mengandalkan migrasi SQL yang dihasilkan untuk SQLite agar otomatis kompatibel dengan MySQL. Buat/generasikan migrasi target MySQL secara khusus dan uji migrasi pada salinan database sebelum cutover.
- Dokumentasikan variabel environment dan cara memilih database. Jangan menyimpan kredensial produksi di repository.
- Tambahkan pengujian integrasi pada MySQL sebelum deployment, walaupun pengembangan harian memakai SQLite.

Jika menggunakan Supabase, perhatikan bahwa layanan database Supabase umumnya menggunakan PostgreSQL, sehingga tidak sesuai dengan target MySQL yang dipilih. Jangan mengasumsikan Supabase sebagai database tanpa persetujuan perubahan kebutuhan.

### Struktur folder awal yang disarankan

```text
src/
  app/
    (customer)/
      menu/[tableToken]/
      order/[orderId]/
    (staff)/
      login/
      cashier/
      kitchen/
      admin/
    api/
  components/
    customer/
    cashier/
    kitchen/
      admin/
    shared/
  lib/
    auth/
    db/
    pricing/
    orders/
    payments/
    printing/
    validation/
  types/
```

Struktur folder boleh diubah berdasarkan framework, tetapi pisahkan komponen UI, aturan bisnis, akses database, validasi, dan otorisasi.

## 16. Strategi Implementasi Bertahap

### Tahap 1 — Fondasi

- Inisialisasi proyek, konfigurasi environment, dan akses database.
- Konfigurasikan SQLite untuk pengembangan lokal serta siapkan skema/migrasi MySQL yang terpisah.
- Verifikasi skema dan query penting berjalan pada kedua database.
- Autentikasi staf dan role.
- CRUD meja, kategori, menu, dan pengaturan restoran.
- Buat seed data demo yang jelas diberi label sebagai data contoh.

### Tahap 2 — Customer ordering

- QR meja dan halaman katalog.
- Keranjang, validasi server, pengiriman order, nomor order, dan pencegahan duplikasi.
- Tampilkan order pada dashboard staf.

### Tahap 3 — Kitchen dan cetak daftar pramusaji

- Antrean kitchen dan transisi status item.
- Status `Siap diantar` terlihat oleh kasir.
- Cetak daftar pesanan yang akan ditempel di meja.
- Tidak membuat panel atau login pramusaji.

### Tahap 4 — Kasir, pembayaran, dan shift

- Login kasir dengan memilih nama dan memasukkan password.
- Pembukaan/penutupan sesi shift kasir.
- Pencatatan saldo kas awal/akhir dan pergerakan kas kecil.
- Pencarian sesi meja dan perhitungan tagihan dari server.
- Pembayaran tunai, QR code statis yang tampil di sistem, dan transfer bank dengan konfirmasi manual.
- Pencegahan pembayaran ganda.
- Kwitansi cetak, riwayat transaksi, dan laporan shift siap cetak.

### Tahap 5 — Cetak, laporan, dan hardening

- Template cetak daftar pesanan, tiket kitchen, dan kwitansi.
- Laporan penjualan dasar.
- Uji otorisasi, validasi, duplikasi, dan kondisi kegagalan.
- Jalankan pengujian integrasi pada MySQL dan uji prosedur migrasi dari data pengembangan yang relevan.
- Dokumentasikan setup, environment, migrasi, seed, backup, dan deployment.

## 17. Instruksi Kerja untuk Antigravity

Gunakan dokumen ini sebagai spesifikasi produk utama. Kerjakan secara bertahap dan jangan mencoba membangun semua modul sekaligus dalam satu perubahan besar.

1. Periksa repository dan pertahankan teknologi serta pola yang sudah ada jika proyek telah dibuat.
2. Sebelum implementasi, buat rencana singkat, identifikasi keputusan yang belum ditentukan, dan jelaskan struktur proyek.
3. Implementasikan satu tahap dalam strategi implementasi pada satu waktu.
4. Buat skema database sebelum membangun UI yang bergantung padanya. SQLite digunakan untuk pengembangan lokal dan MySQL untuk target migrasi/deployment; buat serta uji migrasi khusus untuk masing-masing engine.
5. Gunakan data demo hanya untuk pengembangan; jangan hardcode data demo sebagai transaksi produksi.
6. Validasi semua input dan hak akses di server.
7. Buat komponen reusable untuk status, harga Rupiah, pencarian, dialog konfirmasi, dan tampilan cetak.
8. Tambahkan loading, empty, success, dan error states pada setiap alur utama.
9. Tulis dan jalankan pengujian untuk aturan harga, total tagihan, status item, idempotensi order, pencegahan pembayaran ganda, pembukaan/penutupan shift, laporan per shift, serta pemisahan saldo kas awal dari omzet.
10. Setelah setiap tahap, jalankan lint, type check, tes, dan build yang tersedia; perbaiki error sebelum melanjutkan.
11. Jangan mengklaim fitur sudah berfungsi jika belum diuji.
12. Jangan menambahkan payment gateway, inventori kompleks, atau fitur di luar MVP tanpa persetujuan.
13. Jika ada keputusan bisnis yang belum jelas, gunakan default paling aman yang tertulis dalam PRD dan dokumentasikan asumsi tersebut.
14. Perbarui README dengan cara instalasi, konfigurasi environment, migrasi, seed, menjalankan aplikasi, akun demo nonproduksi, pengujian, dan deployment.

### Definition of Done

MVP dianggap selesai jika alur berikut berhasil diuji dari awal sampai akhir:

1. Admin membuat menu dan meja.
2. Kasir login dengan memilih nama dan memasukkan password, lalu membuka sesi shift dengan saldo kas awal.
3. Pelanggan scan QR meja, memasukkan nama, dan mengirim pesanan.
4. Kasir melihat pesanan dan mencetak daftar pesanan untuk ditempel di meja.
5. Kitchen memproses item dan menandai item siap diantar.
6. Pramusaji mengambil daftar cetak, menempelkannya di meja, dan mencocokkan hidangan secara fisik tanpa mengakses sistem.
7. Kasir menerima pembayaran tunai, QR statis, atau transfer setelah konfirmasi manual, lalu mencetak kwitansi.
8. Kasir menutup shift, meninjau detail seluruh transaksi, dan mencetak laporan shift.
9. Saldo kas yang tetap disimpan di laci menjadi saldo awal shift berikutnya dan tidak dihitung sebagai omzet.
10. Sesi meja menjadi lunas/ditutup dan meja dapat digunakan untuk sesi baru.
11. Hak akses, sesi shift, pencatatan kas, dan pencegahan duplikasi transaksi lolos pengujian.

---

## 18. Asumsi Default yang Perlu Dikonfirmasi

Agar pembangunan awal tidak terhambat, gunakan asumsi berikut sampai pemilik restoran memutuskan sebaliknya:

- Satu restoran/lokasi pada MVP.
- SQLite untuk pengembangan lokal dan MySQL sebagai database target saat migrasi/deployment.
- Mendukung pesanan dine-in QR, take away walk-in, dan pesanan dari platform online eksternal yang dicatat manual oleh kasir.
- Satu mata uang: IDR.
- Pelanggan tidak perlu login.
- Nama pemesan wajib.
- Satu sesi aktif per meja pada satu waktu.
- Pesanan tambahan digabung ke tagihan sesi meja yang sama.
- Tidak ada panel atau akun pramusaji; pramusaji bekerja dengan daftar pesanan cetak dari kasir.
- Pembayaran dilakukan di kasir.
- Metode pembayaran adalah tunai, QR code statis yang ditampilkan oleh sistem, dan transfer bank. Pembayaran QR/transfer dikonfirmasi manual; tidak ada verifikasi payment gateway otomatis.
- Kasir login dengan memilih nama kasir dan memasukkan password.
- Setiap kasir memiliki sesi shift dengan laporan transaksi yang dapat dicetak.
- Kas kecil yang tetap berada di laci dibawa ke shift berikutnya sebagai saldo awal, bukan omzet penjualan.
- Cetak menggunakan dialog cetak browser.
- Pajak dan biaya layanan default 0 sampai dikonfigurasi.
- Pembayaran parsial dan split bill tidak termasuk MVP.
- Kasir login dengan memilih nama dan memasukkan password; admin dan kitchen login sesuai peran. Pramusaji tidak memiliki akun sistem.
- Bahasa UI Bahasa Indonesia dan zona waktu `Asia/Jakarta`.

## 19. Pertanyaan Produk untuk Iterasi Berikutnya

Keputusan berikut dapat dikonfirmasi setelah fondasi MVP berjalan:

- Apakah satu meja dapat memesan berkali-kali dalam satu sesi? Default: ya.
- Platform online apa saja yang digunakan, dan apakah ID pesanan unik per platform? Default: nama platform dikelola admin dan kombinasi platform + ID eksternal harus unik.
- Apakah customer perlu melihat status pesanan dari ponsel? Default: halaman status sederhana.
- Apakah pembayaran dapat dibagi per orang atau per item? Default: tidak untuk MVP.
- Apakah restoran memerlukan printer thermal langsung? Default: cetak browser terlebih dahulu.
- Apakah dibutuhkan stok menu otomatis atau cukup toggle tersedia/tidak tersedia? Default: toggle ketersediaan.
- Apakah QR pembayaran statis menggunakan QRIS milik restoran atau rekening/penyedia tertentu? Default: admin mengunggah gambar QR statis yang benar dan mengatur label penerima.
- Apakah saldo kas kecil harus selalu tetap atau boleh berubah antarshift? Default: saldo akhir fisik yang dikonfirmasi saat shift ditutup menjadi saldo awal shift berikutnya; selisih wajib dicatat.

- Apakah perlu dukungan banyak cabang? Default: satu lokasi.
