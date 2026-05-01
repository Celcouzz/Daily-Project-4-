## 1. Tabel Hasil Uji Coba Sistem
Pengujian dilakukan untuk memastikan fungsionalitas fitur dan keakuratan tampilan data alumni.

| ID | Fitur | Parameter Pengujian | Hasil yang Diharapkan | Status |
|----|-------|---------------------|-----------------------|--------|
| T1 | Autentikasi | Input kredensial admin/umm123 | Masuk ke dashboard & inisialisasi sesi | Berhasil |
| T2 | Statistik | Kalkulasi Total, Terlacak, & Validasi | Angka akurat sesuai database (142k+) | Berhasil |
| T3 | Filtering | Pencarian Nama/NIM & Filter Prodi | Data terfilter secara instan (<300ms) | Berhasil |
| T4 | Modal Detail | Menampilkan 8 poin data sosial & kerja | Informasi lengkap dan tautan aktif (biru) | Berhasil |
| T5 | Keamanan | Push ke GitHub tanpa file config.js | API Key tidak bocor ke repositori publik | Berhasil |

## 2. Rincian Poin Data Alumni (Hasil Validasi)
Berdasarkan uji coba pada fitur *Detail Modal*, data berikut telah berhasil ditarik dan ditampilkan secara sistematis:
1. **Sosial Media**: LinkedIn, Instagram, Facebook, TikTok (Auto-link).
2. **Kontak**: Alamat Email & Nomor HP aktif.
3. **Pekerjaan**: Nama Instansi/Tempat Bekerja & Alamat Kantor.
4. **Jabatan**: Posisi jabatan terakhir alumni.
5. **Klasifikasi**: Status kerja (PNS, Swasta, Wirausaha).
6. **Sosial Media Kantor**: Akun resmi instansi tempat alumni bekerja.
