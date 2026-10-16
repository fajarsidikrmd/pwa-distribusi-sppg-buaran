/**
 * ============================================================================
 * FRONTEND ENGINE PWA DISTRIBUSI & DOKUMEN MBG - SPPG BUARAN
 * Mendukung:
 * 1. Standalone Google Apps Script (GAS) Sync + Offline LocalStorage Fallback
 * 2. Penomoran Surat Otomatis Reset Setiap Bulan Baru (YYYY-MM -> 0001)
 * 3. Kalkulasi Dual-Mode: Data Lapangan (Dropping) vs Data Dapodik (Web BGN)
 * 4. Cetak Presisi 4 Dokumen: Rekap Distribusi, Surat Jalan, BAST, Organoleptik
 * ============================================================================
 */

const STORAGE_KEYS = {
  STATE: 'SPPG_BUARAN_PWA_STATE_V1',
  GAS_URL: 'SPPG_BUARAN_GAS_URL',
  CUSTOM_LOGO: 'SPPG_BUARAN_CUSTOM_LOGO'
};

// SVG Emblem Bawaan Badan Gizi Nasional (Otomatis dipakai jika belum upload logo)
const DEFAULT_BGN_LOGO_SVG = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="57" fill="#0f294a" stroke="#b48a3e" stroke-width="5"/>
  <circle cx="60" cy="60" r="42" fill="#e0f2fe" stroke="#b48a3e" stroke-width="2"/>
  <path d="M40 78 C50 62, 70 62, 80 78" fill="none" stroke="#15803d" stroke-width="5" stroke-linecap="round"/>
  <circle cx="60" cy="48" r="11" fill="#eab308"/>
  <text x="60" y="20" font-family="Arial" font-size="8.5" font-weight="bold" fill="#ffffff" text-anchor="middle">BADAN GIZI NASIONAL</text>
  <text x="60" y="107" font-family="Arial" font-size="8" font-weight="bold" fill="#ffffff" text-anchor="middle">REPUBLIK INDONESIA</text>
</svg>`);

// Data Default Awal SPPG Buaran (Periode 26 - Jumat, 16 Oktober 2026)
const DEFAULT_STATE = {
  config: {
    NAMA_SPPG: 'SPPG Brebes Jatibarang Buaran',
    NAMA_SPPG_PENDEK: 'SPPG Buaran',
    KOTA_SURAT: 'Brebes',
    ALAMAT_SPPG_1: 'Jl. Raya Buaran RT 001/RW 002',
    ALAMAT_SPPG_2: 'Kecamatan Jatibarang, Kabupaten Brebes',
    ALAMAT_SPPG_3: 'Jawa Tengah, 52261',
    KEPALA_SPPG: 'Arifianto Aji Prasetyo, S.M',
    PENGAWAS_DISTRIBUSI: 'Fajar Sidik Romadon, S.Pd',
    PENGAWAS_GIZI: 'Sri Mulyaningsih, A.Md.Gz',
    KOORD_CUCI_OMPRENG: 'Durwati',
    MAX_WAKTU_KONSUMSI: '11.00 WIB',
    PERIODE_AKTIF: 'PERIODE 26 (12 Oktober – 25 Oktober 2026)',
    TANGGAL_AKTIF: '2026-10-16',
    KODE_SURAT_SPPG: 'SPPGBRN',
    DRIVER_BARAT_NAMA: 'Eko Sutikno',
    DRIVER_BARAT_TELP: '085694990000',
    DRIVER_BARAT_MOBIL: 'Suzuki New Carry Box (Hitam)',
    DRIVER_BARAT_NOPOL: 'B 9994 KAY',
    DRIVER_TIMUR_NAMA: 'Tolil',
    DRIVER_TIMUR_TELP: '085647661805',
    DRIVER_TIMUR_MOBIL: 'Suzuki New Carry Box (Putih)',
    DRIVER_TIMUR_NOPOL: 'G 8218 CG',
    SPREADSHEET_URL: ''
  },
  menu: [
    { NO: 1, KATEGORI: 'Karbohidrat', NAMA_MAKANAN: 'Nasi Putih', AKTIF: true },
    { NO: 2, KATEGORI: 'Protein Hewani', NAMA_MAKANAN: 'Ayam Saus Teriyaki', AKTIF: true },
    { NO: 3, KATEGORI: 'Sayur', NAMA_MAKANAN: 'Ca Buncis, Wortel, dan Jagung', AKTIF: true },
    { NO: 4, KATEGORI: 'Protein Nabati', NAMA_MAKANAN: 'Tahu Crispy', AKTIF: true },
    { NO: 5, KATEGORI: 'Buah', NAMA_MAKANAN: 'Jeruk', AKTIF: true },
    { NO: 6, KATEGORI: 'Menu Tambahan', NAMA_MAKANAN: '', AKTIF: false }
  ],
  penomoran: [
    {
      ID_LOG: 'LOG-2026-10-16',
      PERIODE_BULAN: '2026-10',
      TANGGAL_DISTRIBUSI: '2026-10-16',
      BULAN_ROMAWI: 'X',
      NO_AWAL: 134,
      NO_AKHIR: 148,
      JUMLAH_DOKUMEN: 15,
      MENU_RINGKAS: 'Nasi Putih, Ayam Saus Teriyaki, Ca Buncis, Tahu Crispy, Jeruk'
    }
  ],
  kpm: [
    // WILAYAH BARAT
    {
      ID_KPM: 'KPM-B01', URUT_CETAK: 0, URUT_REKAP: 1, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'KB',
      NAMA_REKAP: 'KB AL HIDAYAH RENGASBANDUNG', NAMA_SURAT: 'KB Al Hidayah', NAMA_ORGANOLEPTIK: 'KB Al Hidayah Rengasbandung',
      STATUS_KPM: 'MERGER_DAPODIK',
      LABEL_SASARAN_1: 'Siswa KB (PK)', LAP_PK: 34, DAP_PK: 0,
      LABEL_SASARAN_2: '', LAP_PB_UTAMA: 0, DAP_PB_UTAMA: 0,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 2, DAP_PB_GURU: 0,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Rengasbandung,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: '-', NAMA_PIC: '-', TELEPON_PIC: '-'
    },
    {
      ID_KPM: 'KPM-B02', URUT_CETAK: 5, URUT_REKAP: 2, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'KB',
      NAMA_REKAP: 'KB PERMATA RENGASBANDUNG', NAMA_SURAT: 'KB Permata', NAMA_ORGANOLEPTIK: 'KB Permata Rengasbandung',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Siswa KB (PK)', LAP_PK: 22, DAP_PK: 15,
      LABEL_SASARAN_2: '', LAP_PB_UTAMA: 0, DAP_PB_UTAMA: 0,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 3, DAP_PB_GURU: 2,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Rengasbandung,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Ibu Maspupah', NAMA_PIC: 'Winda Lindriani', TELEPON_PIC: '089518300000'
    },
    {
      ID_KPM: 'KPM-B03', URUT_CETAK: 6, URUT_REKAP: 3, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'TK',
      NAMA_REKAP: 'TK PERTIWI BUARAN', NAMA_SURAT: 'TK Pertiwi Buaran', NAMA_ORGANOLEPTIK: 'TK Pertiwi Buaran',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Siswa TK (PK)', LAP_PK: 43, DAP_PK: 43,
      LABEL_SASARAN_2: '', LAP_PB_UTAMA: 0, DAP_PB_UTAMA: 0,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 2, DAP_PB_GURU: 2,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Buaran,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Ibu Umi Kamal', NAMA_PIC: 'Kharisma Dwi Indri Astuti', TELEPON_PIC: '085712440000'
    },
    {
      ID_KPM: 'KPM-B04', URUT_CETAK: 7, URUT_REKAP: 4, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'TK',
      NAMA_REKAP: 'TK PERTIWI RENGASBANDUNG', NAMA_SURAT: 'TK Pertiwi Rengasbandung', NAMA_ORGANOLEPTIK: 'TK Pertiwi Rengasbandung',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Siswa TK (PK)', LAP_PK: 21, DAP_PK: 62,
      LABEL_SASARAN_2: '', LAP_PB_UTAMA: 0, DAP_PB_UTAMA: 0,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 2, DAP_PB_GURU: 5,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Rengasbandung,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Ibu Nunung Kartini', NAMA_PIC: 'Rokhaeti', TELEPON_PIC: '085741160000'
    },
    {
      ID_KPM: 'KPM-B05', URUT_CETAK: 8, URUT_REKAP: 5, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'RA',
      NAMA_REKAP: 'RA AL MA’MUR KENDAWA', NAMA_SURAT: "RA Al Ma'mur", NAMA_ORGANOLEPTIK: 'RA Al Ma’mur Kendawa',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Siswa RA (PK)', LAP_PK: 22, DAP_PK: 22,
      LABEL_SASARAN_2: '', LAP_PB_UTAMA: 0, DAP_PB_UTAMA: 0,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 4, DAP_PB_GURU: 4,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Kendawa,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Ibu Siti Rokhanah', NAMA_PIC: 'Tukhfatul Mujizah', TELEPON_PIC: '085742440000'
    },
    {
      ID_KPM: 'KPM-B06', URUT_CETAK: 0, URUT_REKAP: 6, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'SD',
      NAMA_REKAP: 'SDN BUARAN 01', NAMA_SURAT: 'SDN Buaran 01', NAMA_ORGANOLEPTIK: 'SDN Buaran 01',
      STATUS_KPM: 'DIBEKUKAN',
      LABEL_SASARAN_1: 'Kelas 1, 2, 3 (PK)', LAP_PK: 77, DAP_PK: 77,
      LABEL_SASARAN_2: 'Kelas 4, 5, 6 (PB)', LAP_PB_UTAMA: 76, DAP_PB_UTAMA: 76,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 10, DAP_PB_GURU: 10,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Buaran,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: '-', NAMA_PIC: '-', TELEPON_PIC: '-'
    },
    {
      ID_KPM: 'KPM-B07', URUT_CETAK: 1, URUT_REKAP: 7, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'SD',
      NAMA_REKAP: 'SDN BUARAN 02', NAMA_SURAT: 'SDN Buaran 02', NAMA_ORGANOLEPTIK: 'SDN Buaran 02',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Kelas 1, 2, 3 (PK)', LAP_PK: 59, DAP_PK: 59,
      LABEL_SASARAN_2: 'Kelas 4, 5, 6 (PB)', LAP_PB_UTAMA: 78, DAP_PB_UTAMA: 78,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 9, DAP_PB_GURU: 9,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Buaran,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Ibu Ida Widiyati', NAMA_PIC: 'Meta Pransisko', TELEPON_PIC: '089520050000'
    },
    {
      ID_KPM: 'KPM-B08', URUT_CETAK: 2, URUT_REKAP: 8, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'SD',
      NAMA_REKAP: 'SDN RENGASBANDUNG 01', NAMA_SURAT: 'SDN Rengasbandung 01', NAMA_ORGANOLEPTIK: 'SDN Rengasbandung 01',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Kelas 1, 2, 3 (PK)', LAP_PK: 89, DAP_PK: 89,
      LABEL_SASARAN_2: 'Kelas 4, 5, 6 (PB)', LAP_PB_UTAMA: 86, DAP_PB_UTAMA: 86,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 11, DAP_PB_GURU: 11,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Rengasbandung,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Bapak Sukartono', NAMA_PIC: 'Farah Amalia Muliana', TELEPON_PIC: '089513100000'
    },
    {
      ID_KPM: 'KPM-B09', URUT_CETAK: 3, URUT_REKAP: 9, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'SD',
      NAMA_REKAP: 'SDN RENGASBANDUNG 02', NAMA_SURAT: 'SDN Rengasbandung 02', NAMA_ORGANOLEPTIK: 'SDN Rengasbandung 02',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Kelas 1, 2, 3 (PK)', LAP_PK: 74, DAP_PK: 74,
      LABEL_SASARAN_2: 'Kelas 4, 5, 6 (PB)', LAP_PB_UTAMA: 79, DAP_PB_UTAMA: 79,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 10, DAP_PB_GURU: 10,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Rengasbandung,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Bapak Tarjo', NAMA_PIC: 'Tri Eko Wiji Prayitno', TELEPON_PIC: '081542210000'
    },
    {
      ID_KPM: 'KPM-B10', URUT_CETAK: 4, URUT_REKAP: 10, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'SD',
      NAMA_REKAP: 'SDN KENDAWA 02', NAMA_SURAT: 'SDN Kendawa 02', NAMA_ORGANOLEPTIK: 'SDN Kendawa 02',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Kelas 1, 2, 3 (PK)', LAP_PK: 83, DAP_PK: 83,
      LABEL_SASARAN_2: 'Kelas 4, 5, 6 (PB)', LAP_PB_UTAMA: 103, DAP_PB_UTAMA: 103,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 13, DAP_PB_GURU: 13,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Kendawa,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Bapak Kidin', NAMA_PIC: 'Mohamad Sukhaemi', TELEPON_PIC: '085786340000'
    },
    {
      ID_KPM: 'KPM-B11', URUT_CETAK: 9, URUT_REKAP: 11, WILAYAH: 'BARAT', JENIS_LEMBAGA: 'POSYANDU',
      NAMA_REKAP: 'POSYANDU BUARAN', NAMA_SURAT: 'Posyandu Buaran', NAMA_ORGANOLEPTIK: 'Posyandu Buaran',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Balita (PK)', LAP_PK: 116, DAP_PK: 116,
      LABEL_SASARAN_2: 'Bumil (PB)', LAP_PB_UTAMA: 17, DAP_PB_UTAMA: 17,
      LABEL_SASARAN_3: 'Busui (PB)', LAP_PB_GURU: 50, DAP_PB_GURU: 50,
      LABEL_SASARAN_4: 'Sampel Organoleptik', LAP_SAMPEL: 1, DAP_SAMPEL: 1,
      DESA_ALAMAT: 'Desa Buaran,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Ibu Budhiarti', NAMA_PIC: 'Sri Rahayu', TELEPON_PIC: '085600680000'
    },

    // WILAYAH TIMUR
    {
      ID_KPM: 'KPM-T01', URUT_CETAK: 10, URUT_REKAP: 1, WILAYAH: 'TIMUR', JENIS_LEMBAGA: 'KB',
      NAMA_REKAP: "KB AL MU'TIAH BUARAN", NAMA_SURAT: "KB Al Mu'tiah", NAMA_ORGANOLEPTIK: 'KB Al Mu’tiah Buaran',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Siswa KB (PK)', LAP_PK: 20, DAP_PK: 20,
      LABEL_SASARAN_2: '', LAP_PB_UTAMA: 0, DAP_PB_UTAMA: 0,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 3, DAP_PB_GURU: 3,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Buaran,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Ibu Sri Muktiningsih', NAMA_PIC: 'Siti Al Munawaroh', TELEPON_PIC: '081915990000'
    },
    {
      ID_KPM: 'KPM-T02', URUT_CETAK: 11, URUT_REKAP: 2, WILAYAH: 'TIMUR', JENIS_LEMBAGA: 'SD',
      NAMA_REKAP: 'SDN KRAMAT 01', NAMA_SURAT: 'SDN Kramat 01', NAMA_ORGANOLEPTIK: 'SDN Kramat 01',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Kelas 1, 2, 3 (PK)', LAP_PK: 89, DAP_PK: 89,
      LABEL_SASARAN_2: 'Kelas 4, 5, 6 (PB)', LAP_PB_UTAMA: 97, DAP_PB_UTAMA: 97,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 12, DAP_PB_GURU: 12,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Kramat,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Bapak Abu Salim', NAMA_PIC: 'Erfina Fatkhiyah', TELEPON_PIC: '085642640000'
    },
    {
      ID_KPM: 'KPM-T03', URUT_CETAK: 12, URUT_REKAP: 3, WILAYAH: 'TIMUR', JENIS_LEMBAGA: 'SD',
      NAMA_REKAP: 'SDN KRAMAT 02', NAMA_SURAT: 'SDN Kramat 02', NAMA_ORGANOLEPTIK: 'SDN Kramat 02',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Kelas 1, 2, 3 (PK)', LAP_PK: 65, DAP_PK: 65,
      LABEL_SASARAN_2: 'Kelas 4, 5, 6 (PB)', LAP_PB_UTAMA: 45, DAP_PB_UTAMA: 45,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 10, DAP_PB_GURU: 10,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Kramat,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Bapak Moh Hanafi', NAMA_PIC: 'Putri Ari Kalinda', TELEPON_PIC: '083815420000'
    },
    {
      ID_KPM: 'KPM-T04', URUT_CETAK: 14, URUT_REKAP: 4, WILAYAH: 'TIMUR', JENIS_LEMBAGA: 'SMK',
      NAMA_REKAP: 'SMK MEKATRONIK KALIPUCANG', NAMA_SURAT: 'SMK Mekatronik', NAMA_ORGANOLEPTIK: 'SMK Mekatronik Kalipucang',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: '', LAP_PK: 0, DAP_PK: 0,
      LABEL_SASARAN_2: 'Kelas 10, 11, 12 (PB)', LAP_PB_UTAMA: 35, DAP_PB_UTAMA: 35,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 15, DAP_PB_GURU: 15,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Kalipucang,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Bapak Syarif Fauzi', NAMA_PIC: 'Nur Habibah', TELEPON_PIC: '085870460000'
    },
    {
      ID_KPM: 'KPM-T05', URUT_CETAK: 13, URUT_REKAP: 5, WILAYAH: 'TIMUR', JENIS_LEMBAGA: 'SMP',
      NAMA_REKAP: 'SMPN 4 JATIBARANG', NAMA_SURAT: 'SMPN 4 Jatibarang', NAMA_ORGANOLEPTIK: 'SMPN 4 Jatibarang',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: '', LAP_PK: 0, DAP_PK: 0,
      LABEL_SASARAN_2: 'Kelas 7, 8, 9 (PB)', LAP_PB_UTAMA: 675, DAP_PB_UTAMA: 675,
      LABEL_SASARAN_3: 'Guru dan Tendik (PB)', LAP_PB_GURU: 49, DAP_PB_GURU: 49,
      LABEL_SASARAN_4: '', LAP_SAMPEL: 0, DAP_SAMPEL: 0,
      DESA_ALAMAT: 'Desa Rengasbandung,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Bapak Parno Hertanto', NAMA_PIC: 'Asih Kurniati', TELEPON_PIC: '081575450000'
    },
    {
      ID_KPM: 'KPM-T06', URUT_CETAK: 15, URUT_REKAP: 6, WILAYAH: 'TIMUR', JENIS_LEMBAGA: 'POSYANDU',
      NAMA_REKAP: 'POSYANDU RENGASBANDUNG', NAMA_SURAT: 'Posyandu Rengasbandung', NAMA_ORGANOLEPTIK: 'Posyandu Rengasbandung',
      STATUS_KPM: 'AKTIF',
      LABEL_SASARAN_1: 'Balita (PK)', LAP_PK: 154, DAP_PK: 154,
      LABEL_SASARAN_2: 'Bumil (PB)', LAP_PB_UTAMA: 19, DAP_PB_UTAMA: 19,
      LABEL_SASARAN_3: 'Busui (PB)', LAP_PB_GURU: 62, DAP_PB_GURU: 62,
      LABEL_SASARAN_4: 'Sampel Organoleptik', LAP_SAMPEL: 1, DAP_SAMPEL: 1,
      DESA_ALAMAT: 'Desa Rengasbandung,', KOTA_KAB: 'Kec Jatibarang, Kab Brebes',
      KEPALA_LEMBAGA: 'Ibu Juningsih', NAMA_PIC: 'Nafsiyah', TELEPON_PIC: '08982203370'
    }
  ],
  posyanduPos: [
    { ID_POS: 'POS-T1', ID_KPM_INDUK: 'KPM-T06', WILAYAH: 'TIMUR', NO_URUT: 1, NAMA_POS: 'POS 1 RENGASBANDUNG', BALITA_PK: 29, BUMIL_BUSUI_PB: 20, SAMPEL_PB: 1 },
    { ID_POS: 'POS-T2', ID_KPM_INDUK: 'KPM-T06', WILAYAH: 'TIMUR', NO_URUT: 2, NAMA_POS: 'POS 2 RENGASBANDUNG', BALITA_PK: 30, BUMIL_BUSUI_PB: 20, SAMPEL_PB: 0 },
    { ID_POS: 'POS-T3', ID_KPM_INDUK: 'KPM-T06', WILAYAH: 'TIMUR', NO_URUT: 3, NAMA_POS: 'POS 3 RENGASBANDUNG', BALITA_PK: 27, BUMIL_BUSUI_PB: 11, SAMPEL_PB: 0 },
    { ID_POS: 'POS-T4', ID_KPM_INDUK: 'KPM-T06', WILAYAH: 'TIMUR', NO_URUT: 4, NAMA_POS: 'POS 4 RENGASBANDUNG', BALITA_PK: 22, BUMIL_BUSUI_PB: 11, SAMPEL_PB: 0 },
    { ID_POS: 'POS-T5', ID_KPM_INDUK: 'KPM-T06', WILAYAH: 'TIMUR', NO_URUT: 5, NAMA_POS: 'POS 5 RENGASBANDUNG', BALITA_PK: 23, BUMIL_BUSUI_PB: 9, SAMPEL_PB: 0 },
    { ID_POS: 'POS-T6', ID_KPM_INDUK: 'KPM-T06', WILAYAH: 'TIMUR', NO_URUT: 6, NAMA_POS: 'POS 6 RENGASBANDUNG', BALITA_PK: 23, BUMIL_BUSUI_PB: 10, SAMPEL_PB: 0 },
    { ID_POS: 'POS-B1', ID_KPM_INDUK: 'KPM-B11', WILAYAH: 'BARAT', NO_URUT: 1, NAMA_POS: 'POS 1 BUARAN', BALITA_PK: 27, BUMIL_BUSUI_PB: 10, SAMPEL_PB: 0 },
    { ID_POS: 'POS-B2', ID_KPM_INDUK: 'KPM-B11', WILAYAH: 'BARAT', NO_URUT: 2, NAMA_POS: 'POS 2 BUARAN', BALITA_PK: 29, BUMIL_BUSUI_PB: 19, SAMPEL_PB: 0 },
    { ID_POS: 'POS-B3', ID_KPM_INDUK: 'KPM-B11', WILAYAH: 'BARAT', NO_URUT: 3, NAMA_POS: 'POS 3 BUARAN', BALITA_PK: 16, BUMIL_BUSUI_PB: 12, SAMPEL_PB: 0 },
    { ID_POS: 'POS-B4', ID_KPM_INDUK: 'KPM-B11', WILAYAH: 'BARAT', NO_URUT: 4, NAMA_POS: 'POS 4 BUARAN', BALITA_PK: 30, BUMIL_BUSUI_PB: 16, SAMPEL_PB: 0 },
    { ID_POS: 'POS-B5', ID_KPM_INDUK: 'KPM-B11', WILAYAH: 'BARAT', NO_URUT: 5, NAMA_POS: 'POS 5 BUARAN', BALITA_PK: 14, BUMIL_BUSUI_PB: 10, SAMPEL_PB: 1 }
  ]
};

let appState = JSON.parse(JSON.stringify(DEFAULT_STATE));
let activeDocType = 'rekap';

// ============================================================================
// 1. INISIALISASI APLIKASI & SERVICE WORKER
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  loadLocalState();
  bindAllUI();
  const savedGasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL);
  if (savedGasUrl) {
    document.getElementById('inpGasUrl').value = savedGasUrl;
    syncFromGAS(true);
  }
});

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATE);
    if (raw) {
      const parsed = JSON.parse(raw);
      appState = Object.assign({}, DEFAULT_STATE, parsed);
    }
  } catch (e) {
    console.warn('Gagal memuat state lokal, menggunakan default:', e);
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(appState));
}

function getLogoSrc() {
  return localStorage.getItem(STORAGE_KEYS.CUSTOM_LOGO) || DEFAULT_BGN_LOGO_SVG;
}

// ============================================================================
// 2. HELPER TANGGAL INDONESIA, BULAN ROMAWI & FORMAT ANGKA
// ============================================================================
const HARI_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function parseDateInfo(dateStr) {
  const parts = (dateStr || '2026-10-16').split('-');
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dt = new Date(year, monthIdx, day);
  return {
    hari: HARI_INDO[dt.getDay()],
    tanggal: day,
    bulanNama: BULAN_INDO[monthIdx],
    bulanRomawi: BULAN_ROMAWI[monthIdx],
    tahun: year,
    periodeBulan: `${parts[0]}-${parts[1]}`,
    fullText: `${HARI_INDO[dt.getDay()]}, ${day} ${BULAN_INDO[monthIdx]} ${year}`,
    shortText: `${day} ${BULAN_INDO[monthIdx]} ${year}`
  };
}

function pad4(num) {
  return String(num).padStart(4, '0');
}

function fmtNum(num) {
  return Number(num || 0).toLocaleString('id-ID');
}

// ============================================================================
// 3. BINDING DATA KE ANTARMUKA DASHBOARD
// ============================================================================
function bindAllUI() {
  const cfg = appState.config;
  document.getElementById('inpTanggal').value = cfg.TANGGAL_AKTIF || '2026-10-16';
  document.getElementById('inpPeriodeRekap').value = cfg.PERIODE_AKTIF || '';

  document.getElementById('cfgKepalaSppg').value = cfg.KEPALA_SPPG || '';
  document.getElementById('cfgPengawasDist').value = cfg.PENGAWAS_DISTRIBUSI || '';
  document.getElementById('cfgPengawasGizi').value = cfg.PENGAWAS_GIZI || '';
  document.getElementById('cfgKoordCuci').value = cfg.KOORD_CUCI_OMPRENG || '';

  document.getElementById('cfgDriverBaratNama').value = cfg.DRIVER_BARAT_NAMA || '';
  document.getElementById('cfgDriverBaratTelp').value = cfg.DRIVER_BARAT_TELP || '';
  document.getElementById('cfgDriverBaratMobil').value = cfg.DRIVER_BARAT_MOBIL || '';
  document.getElementById('cfgDriverBaratNopol').value = cfg.DRIVER_BARAT_NOPOL || '';

  document.getElementById('cfgDriverTimurNama').value = cfg.DRIVER_TIMUR_NAMA || '';
  document.getElementById('cfgDriverTimurTelp').value = cfg.DRIVER_TIMUR_TELP || '';
  document.getElementById('cfgDriverTimurMobil').value = cfg.DRIVER_TIMUR_MOBIL || '';
  document.getElementById('cfgDriverTimurNopol').value = cfg.DRIVER_TIMUR_NOPOL || '';

  if (cfg.SPREADSHEET_URL) {
    const btnSs = document.getElementById('btnOpenSpreadsheet');
    btnSs.href = cfg.SPREADSHEET_URL;
    btnSs.style.display = 'inline-flex';
  }

  onDateChange();
  renderMenuEditor();
  renderKpmMasterTable();
  renderPosyanduPosTable();
  updateSummaryCards();
  renderActivePrintPreview();
}

function updateConfigFromUI() {
  const cfg = appState.config;
  cfg.PERIODE_AKTIF = document.getElementById('inpPeriodeRekap').value;
  cfg.KEPALA_SPPG = document.getElementById('cfgKepalaSppg').value;
  cfg.PENGAWAS_DISTRIBUSI = document.getElementById('cfgPengawasDist').value;
  cfg.PENGAWAS_GIZI = document.getElementById('cfgPengawasGizi').value;
  cfg.KOORD_CUCI_OMPRENG = document.getElementById('cfgKoordCuci').value;

  cfg.DRIVER_BARAT_NAMA = document.getElementById('cfgDriverBaratNama').value;
  cfg.DRIVER_BARAT_TELP = document.getElementById('cfgDriverBaratTelp').value;
  cfg.DRIVER_BARAT_MOBIL = document.getElementById('cfgDriverBaratMobil').value;
  cfg.DRIVER_BARAT_NOPOL = document.getElementById('cfgDriverBaratNopol').value;

  cfg.DRIVER_TIMUR_NAMA = document.getElementById('cfgDriverTimurNama').value;
  cfg.DRIVER_TIMUR_TELP = document.getElementById('cfgDriverTimurTelp').value;
  cfg.DRIVER_TIMUR_MOBIL = document.getElementById('cfgDriverTimurMobil').value;
  cfg.DRIVER_TIMUR_NOPOL = document.getElementById('cfgDriverTimurNopol').value;

  saveLocalState();
  updateSummaryCards();
  renderActivePrintPreview();
}

// ============================================================================
// 4. LOGIKA PENOMORAN OTOMATIS RESET SETIAP BULAN (YYYY-MM)
// ============================================================================
function getActivePrintableInstitutions() {
  return appState.kpm
    .filter(item => item.STATUS_KPM === 'AKTIF')
    .sort((a, b) => Number(a.URUT_CETAK) - Number(b.URUT_CETAK));
}

function onDateChange() {
  const dateStr = document.getElementById('inpTanggal').value || '2026-10-16';
  appState.config.TANGGAL_AKTIF = dateStr;
  const info = parseDateInfo(dateStr);

  document.getElementById('lblTanggalIndo').textContent = info.fullText;
  document.getElementById('badgePeriodeBulan').textContent = `Periode: ${info.periodeBulan} (Romawi: ${info.bulanRomawi})`;
  document.getElementById('lblHistoryMonth').textContent = info.periodeBulan;

  // Cek riwayat penomoran di bulan yang sama (YYYY-MM)
  const monthLogs = (appState.penomoran || []).filter(
    r => String(r.PERIODE_BULAN) === info.periodeBulan
  );

  const exactLog = monthLogs.find(r => String(r.TANGGAL_DISTRIBUSI) === dateStr);
  let nextNoAwal = 1; // Default otomatis reset ke 0001 jika bulan baru!

  if (exactLog) {
    nextNoAwal = Number(exactLog.NO_AWAL) || 1;
  } else if (monthLogs.length > 0) {
    // Ambil NO_AKHIR tertinggi pada bulan tersebut lalu + 1
    const maxAkhir = Math.max(...monthLogs.map(r => Number(r.NO_AKHIR) || 0));
    nextNoAwal = maxAkhir + 1;
  }

  document.getElementById('inpNoAwal').value = nextNoAwal;
  recalculateNumberingPreview();
  renderMonthlyLogTable(info.periodeBulan);
  saveLocalState();
  renderActivePrintPreview();
}

function recalculateNumberingPreview() {
  const dateStr = document.getElementById('inpTanggal').value || '2026-10-16';
  const info = parseDateInfo(dateStr);
  const noAwal = Math.max(1, parseInt(document.getElementById('inpNoAwal').value || '1', 10));
  const activeCount = getActivePrintableInstitutions().length;
  const noAkhir = activeCount > 0 ? (noAwal + activeCount - 1) : noAwal;
  const kode = appState.config.KODE_SURAT_SPPG || 'SPPGBRN';

  document.getElementById('lblRangeNomor').innerHTML =
    `Rentang Hari Ini: <strong>${pad4(noAwal)}</strong> s/d <strong>${pad4(noAkhir)}</strong> (${activeCount} Lembaga Aktif)`;

  document.getElementById('lblContohNomor').innerHTML =
    `SJ: ${pad4(noAwal)}/SJ/${kode}/${info.bulanRomawi}/${info.tahun}<br/>` +
    `BAST: ${pad4(noAwal)}/BAST/${kode}/${info.bulanRomawi}/${info.tahun}`;

  renderActivePrintPreview();
}

function resetTo0001() {
  document.getElementById('inpNoAwal').value = 1;
  recalculateNumberingPreview();
}

function renderMonthlyLogTable(periodeBulan) {
  const tbody = document.getElementById('tbodyLogPenomoran');
  const logs = (appState.penomoran || [])
    .filter(r => String(r.PERIODE_BULAN) === periodeBulan)
    .sort((a, b) => String(a.TANGGAL_DISTRIBUSI).localeCompare(String(b.TANGGAL_DISTRIBUSI)));

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">Bulan baru (${periodeBulan}) — Penomoran otomatis dimulai dari <strong>0001</strong>.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(r => `
    <tr>
      <td><strong>${r.TANGGAL_DISTRIBUSI}</strong></td>
      <td style="text-align:center;">${pad4(r.NO_AWAL)}</td>
      <td style="text-align:center;">${pad4(r.NO_AKHIR)}</td>
      <td style="text-align:center;">${r.JUMLAH_DOKUMEN}</td>
      <td style="text-align:center;">
        <button type="button" class="btn btn-sm btn-outline" onclick="loadDateFromLog('${r.TANGGAL_DISTRIBUSI}')">Pilih</button>
      </td>
    </tr>
  `).join('');
}

function loadDateFromLog(tanggal) {
  document.getElementById('inpTanggal').value = tanggal;
  onDateChange();
}

// ============================================================================
// 5. EDITOR MENU HARIAN (UNTUK CHECKLIST ORGANOLEPTIK)
// ============================================================================
function renderMenuEditor() {
  const tbody = document.getElementById('tbodyMenuHarian');
  tbody.innerHTML = appState.menu.map((item, idx) => `
    <tr>
      <td style="text-align:center;font-weight:700;">${idx + 1}.</td>
      <td>
        <input type="text" value="${item.KATEGORI || ''}"
          oninput="updateMenuRow(${idx}, 'KATEGORI', this.value)" />
      </td>
      <td>
        <input type="text" value="${item.NAMA_MAKANAN || ''}" placeholder="Ketik nama menu makanan..."
          oninput="updateMenuRow(${idx}, 'NAMA_MAKANAN', this.value)" />
      </td>
      <td style="text-align:center;">
        <input type="checkbox" ${item.AKTIF ? 'checked' : ''}
          onchange="updateMenuRow(${idx}, 'AKTIF', this.checked)" />
      </td>
    </tr>
  `).join('');
}

function updateMenuRow(idx, field, value) {
  appState.menu[idx][field] = value;
  if (field === 'NAMA_MAKANAN' && String(value).trim() !== '') {
    appState.menu[idx].AKTIF = true;
  }
  saveLocalState();
  renderActivePrintPreview();
}

function addMenuRow() {
  appState.menu.push({
    NO: appState.menu.length + 1,
    KATEGORI: 'Tambahan',
    NAMA_MAKANAN: '',
    AKTIF: false
  });
  renderMenuEditor();
  saveLocalState();
}

// ============================================================================
// 6. TABEL EDITOR KPM (LAPANGAN VS DAPODIK) & POSYANDU PER POS
// ============================================================================
function renderKpmMasterTable() {
  const tbody = document.getElementById('tbodyKpmMaster');
  tbody.innerHTML = appState.kpm.map((k, idx) => {
    const rowClass = k.STATUS_KPM === 'DIBEKUKAN'
      ? 'row-dibekukan'
      : (k.STATUS_KPM === 'MERGER_DAPODIK' ? 'row-merger' : '');

    return `
      <tr class="${rowClass}">
        <td style="text-align:center;font-weight:700;">${k.WILAYAH}</td>
        <td style="width:65px;">
          <input type="number" value="${k.URUT_CETAK}"
            oninput="updateKpmField(${idx}, 'URUT_CETAK', Number(this.value))" />
        </td>
        <td>
          <strong>${k.NAMA_REKAP}</strong><br/>
          <small style="color:#475569;">Nama Surat: ${k.NAMA_SURAT}</small>
        </td>
        <td style="width:155px;">
          <select onchange="updateKpmField(${idx}, 'STATUS_KPM', this.value)">
            <option value="AKTIF" ${k.STATUS_KPM === 'AKTIF' ? 'selected' : ''}>AKTIF</option>
            <option value="DIBEKUKAN" ${k.STATUS_KPM === 'DIBEKUKAN' ? 'selected' : ''}>DIBEKUKAN (BGN)</option>
            <option value="MERGER_DAPODIK" ${k.STATUS_KPM === 'MERGER_DAPODIK' ? 'selected' : ''}>MERGER DAPODIK</option>
          </select>
        </td>
        <td><input type="number" value="${k.LAP_PK}" oninput="updateKpmField(${idx}, 'LAP_PK', Number(this.value))" /></td>
        <td><input type="number" value="${k.LAP_PB_UTAMA}" oninput="updateKpmField(${idx}, 'LAP_PB_UTAMA', Number(this.value))" /></td>
        <td><input type="number" value="${k.LAP_PB_GURU}" oninput="updateKpmField(${idx}, 'LAP_PB_GURU', Number(this.value))" /></td>
        <td><input type="number" value="${k.DAP_PK}" oninput="updateKpmField(${idx}, 'DAP_PK', Number(this.value))" /></td>
        <td><input type="number" value="${k.DAP_PB_UTAMA}" oninput="updateKpmField(${idx}, 'DAP_PB_UTAMA', Number(this.value))" /></td>
        <td><input type="number" value="${k.DAP_PB_GURU}" oninput="updateKpmField(${idx}, 'DAP_PB_GURU', Number(this.value))" /></td>
        <td>
          <input type="text" value="${k.KEPALA_LEMBAGA}" placeholder="Kepala Lembaga"
            oninput="updateKpmField(${idx}, 'KEPALA_LEMBAGA', this.value)" style="margin-bottom:4px;" />
          <input type="text" value="${k.NAMA_PIC}" placeholder="Nama PIC"
            oninput="updateKpmField(${idx}, 'NAMA_PIC', this.value)" />
        </td>
      </tr>
    `;
  }).join('');
}

function updateKpmField(idx, field, value) {
  appState.kpm[idx][field] = value;
  saveLocalState();
  if (field === 'STATUS_KPM' || field === 'URUT_CETAK') {
    renderKpmMasterTable();
    recalculateNumberingPreview();
  }
  updateSummaryCards();
  renderActivePrintPreview();
}

function renderPosyanduPosTable() {
  const tbody = document.getElementById('tbodyPosyanduPos');
  tbody.innerHTML = appState.posyanduPos.map((p, idx) => {
    const totalPos = Number(p.BALITA_PK || 0) + Number(p.BUMIL_BUSUI_PB || 0) + Number(p.SAMPEL_PB || 0);
    return `
      <tr>
        <td style="text-align:center;font-weight:700;">${p.WILAYAH}</td>
        <td style="text-align:center;">${p.NO_URUT}</td>
        <td><strong>${p.NAMA_POS}</strong></td>
        <td><input type="number" value="${p.BALITA_PK}" oninput="updatePosField(${idx}, 'BALITA_PK', Number(this.value))" /></td>
        <td><input type="number" value="${p.BUMIL_BUSUI_PB}" oninput="updatePosField(${idx}, 'BUMIL_BUSUI_PB', Number(this.value))" /></td>
        <td><input type="number" value="${p.SAMPEL_PB}" oninput="updatePosField(${idx}, 'SAMPEL_PB', Number(this.value))" /></td>
        <td style="text-align:center;font-weight:700;">${totalPos} Ompreng</td>
      </tr>
    `;
  }).join('');
}

function updatePosField(idx, field, value) {
  appState.posyanduPos[idx][field] = value;
  // Sinkronkan total Balita PK & Sampel ke KPM Induk Posyandu
  const parentId = appState.posyanduPos[idx].ID_KPM_INDUK;
  const childPos = appState.posyanduPos.filter(p => p.ID_KPM_INDUK === parentId);
  const sumPk = childPos.reduce((acc, r) => acc + Number(r.BALITA_PK || 0), 0);
  const sumSampel = childPos.reduce((acc, r) => acc + Number(r.SAMPEL_PB || 0), 0);

  const parentKpm = appState.kpm.find(k => k.ID_KPM === parentId);
  if (parentKpm) {
    parentKpm.LAP_PK = sumPk;
    parentKpm.DAP_PK = sumPk;
    parentKpm.LAP_SAMPEL = sumSampel;
    parentKpm.DAP_SAMPEL = sumSampel;
  }

  saveLocalState();
  renderPosyanduPosTable();
  renderKpmMasterTable();
  updateSummaryCards();
  renderActivePrintPreview();
}

// ============================================================================
// 7. KALKULATOR RINGKASAN KUOTA PER WILAYAH
// ============================================================================
function calculateWilayahSummary(wilayah, mode = 'LAPANGAN') {
  const isLap = mode === 'LAPANGAN';
  // Sekolah aktif (kecualikan yang DIBEKUKAN dari penjumlahan aktif)
  const schools = appState.kpm
    .filter(k => k.WILAYAH === wilayah && k.JENIS_LEMBAGA !== 'POSYANDU')
    .sort((a, b) => Number(a.URUT_REKAP) - Number(b.URUT_REKAP));

  let schoolPk = 0;
  let schoolPb = 0;

  schools.forEach(s => {
    if (s.STATUS_KPM === 'DIBEKUKAN') return; // SDN Buaran 01 dikecualikan dari total aktif
    if (!isLap && s.STATUS_KPM === 'MERGER_DAPODIK') return;

    const pk = Number(isLap ? s.LAP_PK : s.DAP_PK) || 0;
    const pb1 = Number(isLap ? s.LAP_PB_UTAMA : s.DAP_PB_UTAMA) || 0;
    const pb2 = Number(isLap ? s.LAP_PB_GURU : s.DAP_PB_GURU) || 0;
    schoolPk += pk;
    schoolPb += (pb1 + pb2);
  });

  const posList = appState.posyanduPos
    .filter(p => p.WILAYAH === wilayah)
    .sort((a, b) => Number(a.NO_URUT) - Number(b.NO_URUT));

  let posPk = 0;
  let posPb = 0;
  posList.forEach(p => {
    posPk += Number(p.BALITA_PK || 0);
    posPb += (Number(p.BUMIL_BUSUI_PB || 0) + Number(p.SAMPEL_PB || 0));
  });

  return {
    schoolPk,
    schoolPb,
    schoolTotal: schoolPk + schoolPb,
    posPk,
    posPb,
    posTotal: posPk + posPb,
    grandWilayah: schoolPk + schoolPb + posPk + posPb
  };
}

function updateSummaryCards() {
  const cfg = appState.config;
  const timur = calculateWilayahSummary('TIMUR', 'LAPANGAN');
  const barat = calculateWilayahSummary('BARAT', 'LAPANGAN');

  document.getElementById('lblDriverTimur').textContent = cfg.DRIVER_TIMUR_NAMA || 'Tolil';
  document.getElementById('valTotalTimur').innerHTML = `${fmtNum(timur.grandWilayah)} <span>Ompreng</span>`;
  document.getElementById('subDetailTimur').textContent =
    `Sekolah: ${fmtNum(timur.schoolTotal)} (${timur.schoolPk} PK + ${timur.schoolPb} PB) | Posyandu: ${fmtNum(timur.posTotal)}`;

  document.getElementById('lblDriverBarat').textContent = cfg.DRIVER_BARAT_NAMA || 'Eko Sutikno';
  document.getElementById('valTotalBarat').innerHTML = `${fmtNum(barat.grandWilayah)} <span>Ompreng</span>`;
  document.getElementById('subDetailBarat').textContent =
    `Sekolah: ${fmtNum(barat.schoolTotal)} (${barat.schoolPk} PK + ${barat.schoolPb} PB) | Posyandu: ${fmtNum(barat.posTotal)}`;

  document.getElementById('valGrandTotal').innerHTML =
    `${fmtNum(timur.grandWilayah + barat.grandWilayah)} <span>Ompreng</span>`;
}

// ============================================================================
// 8. ENGINE CETAK 4 DOKUMEN (REKAP, SURAT JALAN, BAST, ORGANOLEPTIK)
// ============================================================================
function selectDocType(docType) {
  activeDocType = docType;
  document.querySelectorAll('.doc-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.doc === docType);
  });
  document.getElementById('wrapModeRekap').style.display = (docType === 'rekap') ? 'flex' : 'none';
  renderActivePrintPreview();
}

function renderActivePrintPreview() {
  const container = document.getElementById('printAreaContainer');
  const filterWilayah = document.getElementById('selFilterWilayah').value || 'ALL';
  const modeRekap = document.getElementById('selModeRekap').value || 'LAPANGAN';

  if (activeDocType === 'rekap') {
    container.innerHTML = generateRekapHTML(filterWilayah, modeRekap);
  } else if (activeDocType === 'sj') {
    container.innerHTML = generateSuratJalanHTML(filterWilayah);
  } else if (activeDocType === 'bast') {
    container.innerHTML = generateBastHTML(filterWilayah);
  } else if (activeDocType === 'organoleptik') {
    container.innerHTML = generateOrganoleptikHTML(filterWilayah);
  }
}

// --- A. GENERATOR REKAP PORSI DISTRIBUSI ---
function generateRekapHTML(filterWilayah, mode) {
  const wilayahList = filterWilayah === 'ALL' ? ['TIMUR', 'BARAT'] : [filterWilayah];
  const isLap = mode === 'LAPANGAN';
  const periodeText = appState.config.PERIODE_AKTIF || 'PERIODE 26 (12 Oktober – 25 Oktober 2026)';

  return wilayahList.map(wil => {
    const schools = appState.kpm
      .filter(k => k.WILAYAH === wil && k.JENIS_LEMBAGA !== 'POSYANDU')
      .sort((a, b) => Number(a.URUT_REKAP) - Number(b.URUT_REKAP));

    const posList = appState.posyanduPos
      .filter(p => p.WILAYAH === wil)
      .sort((a, b) => Number(a.NO_URUT) - Number(b.NO_URUT));

    const calc = calculateWilayahSummary(wil, mode);

    const schoolRowsHtml = schools.map((s, idx) => {
      const pk = Number(isLap ? s.LAP_PK : s.DAP_PK) || 0;
      const pbUtama = Number(isLap ? s.LAP_PB_UTAMA : s.DAP_PB_UTAMA) || 0;
      const pbGuru = Number(isLap ? s.LAP_PB_GURU : s.DAP_PB_GURU) || 0;
      const pbSum = pbUtama + pbGuru;
      const rowTotal = pk + pbSum;

      const pkCol = pk > 0 ? pk : '-';
      let pbRincianCol = '-';
      let pbHasilCol = '-';

      if (pbUtama > 0 && pbGuru > 0) {
        pbRincianCol = `${pbUtama} + ${pbGuru}`;
        pbHasilCol = pbSum;
      } else if (pbSum > 0) {
        pbRincianCol = pbSum;
        pbHasilCol = '-';
      }

      const statusNote = s.STATUS_KPM === 'DIBEKUKAN' ? ' <em>(Dibekukan BGN)</em>' : '';

      return `
        <tr style="${s.STATUS_KPM === 'DIBEKUKAN' ? 'color:#64748b;' : ''}">
          <td class="num">${idx + 1}</td>
          <td>${s.NAMA_REKAP}${statusNote}</td>
          <td class="num">${pkCol}</td>
          <td class="num">-</td>
          <td class="num">${pbRincianCol}</td>
          <td class="num">${pbHasilCol}</td>
          <td class="num"><strong>${rowTotal}</strong></td>
        </tr>
      `;
    }).join('');

    const posRowsHtml = posList.map((p, idx) => {
      const pk = Number(p.BALITA_PK || 0);
      const pb = Number(p.BUMIL_BUSUI_PB || 0);
      const sampel = Number(p.SAMPEL_PB || 0);
      const pbRincian = sampel > 0 ? `${pb} + ${sampel}` : pb;
      const pbHasil = sampel > 0 ? (pb + sampel) : '-';
      const totalPos = pk + pb + sampel;

      return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>${p.NAMA_POS}</td>
          <td class="num">${pk}</td>
          <td class="num">-</td>
          <td class="num">${pbRincian}</td>
          <td class="num">${pbHasil}</td>
          <td class="num"><strong>${totalPos}</strong></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-sheet sheet-rekap">
        <div class="rekap-title">DISTRIBUSI WILAYAH ${wil}</div>
        <div class="rekap-subtitle">${periodeText}</div>

        <table class="tbl-rekap">
          <thead>
            <tr>
              <th rowspan="2" style="width:36px;">NO</th>
              <th rowspan="2">NAMA SEKOLAH</th>
              <th colspan="4">PORSI</th>
              <th rowspan="2" style="width:110px;">TOTAL OMPRENG</th>
            </tr>
            <tr>
              <th colspan="2">KECIL</th>
              <th colspan="2">BESAR</th>
            </tr>
          </thead>
          <tbody>
            ${schoolRowsHtml}
            <tr class="total-row">
              <td colspan="2" class="num">TOTAL</td>
              <td colspan="2" class="num">${fmtNum(calc.schoolPk)}</td>
              <td colspan="2" class="num">${fmtNum(calc.schoolPb)}</td>
              <td class="num">${fmtNum(calc.schoolTotal)}</td>
            </tr>
          </tbody>
        </table>

        <table class="tbl-rekap">
          <thead>
            <tr>
              <th rowspan="2" style="width:36px;">NO</th>
              <th rowspan="2">NAMA POSYANDU</th>
              <th colspan="4">PORSI</th>
              <th rowspan="2" style="width:110px;">TOTAL OMPRENG</th>
            </tr>
            <tr>
              <th colspan="2">KECIL</th>
              <th colspan="2">BESAR</th>
            </tr>
          </thead>
          <tbody>
            ${posRowsHtml}
            <tr class="total-row">
              <td colspan="2" class="num">TOTAL</td>
              <td colspan="2" class="num">${fmtNum(calc.posPk)}</td>
              <td colspan="2" class="num">${fmtNum(calc.posPb)}</td>
              <td class="num">${fmtNum(calc.posTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="rekap-grand-box">
          TOTAL OMPRENG WILAYAH ${wil}: ${fmtNum(calc.grandWilayah)}
        </div>
      </div>
    `;
  }).join('');
}

// --- B. HELPER SASARAN DAPODIK UNTUK SURAT JALAN & BAST ---
function buildDapodikSasaranRows(kpmItem) {
  const rows = [];
  if (kpmItem.LABEL_SASARAN_1 && Number(kpmItem.DAP_PK) > 0) {
    rows.push({ label: kpmItem.LABEL_SASARAN_1, jumlah: Number(kpmItem.DAP_PK) });
  }
  if (kpmItem.LABEL_SASARAN_2 && Number(kpmItem.DAP_PB_UTAMA) > 0) {
    rows.push({ label: kpmItem.LABEL_SASARAN_2, jumlah: Number(kpmItem.DAP_PB_UTAMA) });
  }
  if (kpmItem.LABEL_SASARAN_3 && Number(kpmItem.DAP_PB_GURU) > 0) {
    rows.push({ label: kpmItem.LABEL_SASARAN_3, jumlah: Number(kpmItem.DAP_PB_GURU) });
  }
  if (kpmItem.LABEL_SASARAN_4 && Number(kpmItem.DAP_SAMPEL) > 0) {
    rows.push({ label: kpmItem.LABEL_SASARAN_4, jumlah: Number(kpmItem.DAP_SAMPEL) });
  }
  const totalPorsi = rows.reduce((acc, r) => acc + r.jumlah, 0);
  return { rows, totalPorsi };
}

function getDriverForWilayah(wilayah) {
  const cfg = appState.config;
  if (wilayah === 'BARAT') {
    return {
      nama: cfg.DRIVER_BARAT_NAMA,
      telp: cfg.DRIVER_BARAT_TELP,
      mobil: cfg.DRIVER_BARAT_MOBIL,
      nopol: cfg.DRIVER_BARAT_NOPOL
    };
  }
  return {
    nama: cfg.DRIVER_TIMUR_NAMA,
    telp: cfg.DRIVER_TIMUR_TELP,
    mobil: cfg.DRIVER_TIMUR_MOBIL,
    nopol: cfg.DRIVER_TIMUR_NOPOL
  };
}

// --- C. GENERATOR SURAT JALAN (2 RANGKAP KIRI-KANAN PER HALAMAN) ---
function generateSuratJalanHTML(filterWilayah) {
  const cfg = appState.config;
  const dateInfo = parseDateInfo(cfg.TANGGAL_AKTIF);
  const noAwal = Math.max(1, parseInt(document.getElementById('inpNoAwal').value || '1', 10));
  const logoSrc = getLogoSrc();
  const kode = cfg.KODE_SURAT_SPPG || 'SPPGBRN';

  const allActive = getActivePrintableInstitutions();

  return allActive.map((item, idx) => {
    const nomorUrut = noAwal + idx; // Nomor urut tetap konsisten sesuai urutan harian
    if (filterWilayah !== 'ALL' && item.WILAYAH !== filterWilayah) return '';

    const nomorSurat = `${pad4(nomorUrut)}/SJ/${kode}/${dateInfo.bulanRomawi}/${dateInfo.tahun}`;
    const drv = getDriverForWilayah(item.WILAYAH);
    const sasaranData = buildDapodikSasaranRows(item);

    // Selalu cetak minimal 4 baris pada tabel sasaran sesuai template Surat Jalan SPPG Buaran
    let tableRowsHtml = '';
    for (let i = 0; i < 4; i++) {
      const r = sasaranData.rows[i];
      tableRowsHtml += `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${r ? r.label : '&nbsp;'}</td>
          <td style="text-align:center;font-weight:700;">${r ? r.jumlah : ''}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }

    const singleCopyHtml = `
      <div class="sj-copy">
        <div class="sj-header">
          <img src="${logoSrc}" alt="Logo BGN" class="sj-logo" />
          <div class="sj-header-text">
            <h2>SURAT JALAN</h2>
            <h3>${cfg.NAMA_SPPG_PENDEK.toUpperCase()}</h3>
            <p>${cfg.ALAMAT_SPPG_1}<br/>${cfg.ALAMAT_SPPG_2}<br/>${cfg.ALAMAT_SPPG_3}</p>
          </div>
        </div>

        <div class="sj-meta">
          <table class="sj-info-table">
            <tr><td style="width:85px;"><strong>Hari, tanggal</strong></td><td>: ${dateInfo.fullText}</td></tr>
            <tr><td><strong>Nomor</strong></td><td>: <strong>${nomorSurat}</strong></td></tr>
          </table>
        </div>

        <div class="sj-info-grid">
          <div class="sj-info-box">
            <h4>Informasi Pengirim:</h4>
            <table class="sj-info-table">
              <tr><td style="width:78px;">Program</td><td>: MAKANAN BERGIZI GRATIS</td></tr>
              <tr><td>SPPG Pengirim</td><td>: ${cfg.NAMA_SPPG}</td></tr>
              <tr><td>Nama Driver</td><td>: ${drv.nama}</td></tr>
              <tr><td>Kendaraan</td><td>: ${drv.mobil}</td></tr>
              <tr><td>No. Polisi</td><td>: ${drv.nopol}</td></tr>
            </table>
          </div>
          <div class="sj-info-box">
            <h4>Informasi Penerima:</h4>
            <table class="sj-info-table">
              <tr><td style="width:82px;">Lembaga</td><td>: <strong>${item.NAMA_SURAT}</strong></td></tr>
              <tr><td>Kepala Lembaga</td><td>: ${item.KEPALA_LEMBAGA}</td></tr>
              <tr><td>Alamat Lembaga</td><td>: ${item.DESA_ALAMAT} ${item.KOTA_KAB}</td></tr>
              <tr><td>Nama PIC</td><td>: ${item.NAMA_PIC}</td></tr>
              <tr><td>Telepon</td><td>: ${item.TELEPON_PIC}</td></tr>
            </table>
          </div>
        </div>

        <table class="tbl-sj">
          <thead>
            <tr>
              <th rowspan="2" style="width:26px;">No</th>
              <th rowspan="2">Sasaran</th>
              <th rowspan="2" style="width:68px;">Jumlah Paket</th>
              <th colspan="2">Jumlah Alat Makan</th>
              <th rowspan="2" style="width:55px;">Paraf</th>
              <th rowspan="2" style="width:70px;">Keterangan</th>
            </tr>
            <tr>
              <th style="width:65px;">Penerimaan</th>
              <th style="width:65px;">Pengambilan</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr>
              <td colspan="2" style="text-align:right;font-weight:700;">Total Keseluruhan:</td>
              <td style="text-align:center;font-weight:700;">${sasaranData.totalPorsi} Porsi</td>
              <td style="text-align:center;">.......... Set</td>
              <td style="text-align:center;">.......... Set</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>

        <div class="sj-notes">
          <strong>Catatan :</strong> Porsi Kecil (PK), Porsi Besar (PB). Paket MBG telah diterima dengan baik dan sesuai dengan jumlah penerima manfaat.
        </div>

        <div class="sj-sign-grid">
          <div>
            Pengawas Gizi<br/>${cfg.NAMA_SPPG_PENDEK}
            <div class="sj-sign-space"></div>
            <strong>${cfg.PENGAWAS_GIZI}</strong><br/>
            ( .................................... )
          </div>
          <div>
            Asisten Lapangan<br/>${cfg.NAMA_SPPG_PENDEK}
            <div class="sj-sign-space"></div>
            <strong>${cfg.PENGAWAS_DISTRIBUSI}</strong><br/>
            ( .................................... )
          </div>
          <div>
            Petugas Distribusi<br/>${cfg.NAMA_SPPG_PENDEK}
            <div class="sj-sign-space"></div>
            <strong>${drv.nama}</strong><br/>
            ( .................................... )
          </div>
        </div>

        <div class="sj-slogan">
          WUJUDKAN GENERASI SEHAT MENUJU INDONESIA EMAS 2045
        </div>
      </div>
    `;

    return `
      <div class="print-sheet sheet-sj-landscape">
        <div class="sj-two-up-grid">
          ${singleCopyHtml}
          ${singleCopyHtml}
        </div>
      </div>
    `;
  }).join('');
}

// --- D. GENERATOR BAST (PENERIMAAN & PENGEMBALIAN DALAM 1 HALAMAN) ---
function generateBastHTML(filterWilayah) {
  const cfg = appState.config;
  const dateInfo = parseDateInfo(cfg.TANGGAL_AKTIF);
  const noAwal = Math.max(1, parseInt(document.getElementById('inpNoAwal').value || '1', 10));
  const logoSrc = getLogoSrc();
  const kode = cfg.KODE_SURAT_SPPG || 'SPPGBRN';

  const allActive = getActivePrintableInstitutions();

  return allActive.map((item, idx) => {
    const nomorUrut = noAwal + idx;
    if (filterWilayah !== 'ALL' && item.WILAYAH !== filterWilayah) return '';

    const nomorBast = `${pad4(nomorUrut)}/BAST/${kode}/${dateInfo.bulanRomawi}/${dateInfo.tahun}`;
    const drv = getDriverForWilayah(item.WILAYAH);
    const sasaranData = buildDapodikSasaranRows(item);

    return `
      <div class="print-sheet sheet-bast">
        <!-- SEPARUH ATAS: BAST PENERIMAAN PAKET MBG -->
        <div class="bast-half">
          <div class="bast-top-header">
            <img src="${logoSrc}" alt="Logo BGN" class="bast-logo" />
            <h2>BERITA ACARA SERAH TERIMA<br/>PENERIMAAN PAKET MAKAN BERGIZI GRATIS</h2>
            <div class="bast-no">No: ${nomorBast}</div>
          </div>

          <p class="bast-body-text">
            Pada hari <strong>${dateInfo.hari}, ${dateInfo.shortText}</strong> pukul ………….. telah diserahkan paket makanan bergizi sejumlah: <strong>${sasaranData.totalPorsi} paket</strong>.
            Paket makanan bergizi dari Satuan Pelayanan Pemenuhan Gizi Brebes Jatibarang Buaran.
            Maximum waktu ompreng dikonsumsi pukul <strong>${cfg.MAX_WAKTU_KONSUMSI}</strong>.
          </p>

          <div class="bast-parties-grid">
            <div>
              <table class="bast-party-table">
                <tr><td style="width:110px;">Yang menyerahkan</td><td>: <strong>${cfg.NAMA_SPPG_PENDEK}</strong></td></tr>
                <tr><td>Nama Driver</td><td>: ${drv.nama}</td></tr>
                <tr><td>No Telepon</td><td>: ${drv.telp}</td></tr>
              </table>
              <div class="bast-sign-line">(…………………………………..)</div>
            </div>
            <div>
              <table class="bast-party-table">
                <tr><td style="width:110px;">Diterima oleh</td><td>: <strong>${item.NAMA_SURAT}</strong></td></tr>
                <tr><td>Nama PIC</td><td>: ${item.NAMA_PIC}</td></tr>
                <tr><td>No Telepon</td><td>: ${item.TELEPON_PIC}</td></tr>
              </table>
              <div class="bast-sign-line">(…………………………………..)</div>
            </div>
          </div>

          <div class="bast-knowing-title">Mengetahui,</div>
          <div class="bast-knowing-grid">
            <div>
              Kepala ${cfg.NAMA_SPPG_PENDEK}
              <div class="bast-knowing-space"></div>
              <strong>${cfg.KEPALA_SPPG}</strong>
            </div>
            <div>
              Pengawas Distribusi
              <div class="bast-knowing-space"></div>
              <strong>${cfg.PENGAWAS_DISTRIBUSI}</strong>
            </div>
          </div>
        </div>

        <div class="bast-divider"></div>

        <!-- SEPARUH BAWAH: BAST PENGEMBALIAN ALAT MAKAN -->
        <div class="bast-half">
          <div class="bast-top-header">
            <img src="${logoSrc}" alt="Logo BGN" class="bast-logo" />
            <h2>BERITA ACARA SERAH TERIMA<br/>PENGEMBALIAN ALAT MAKAN BERGIZI GRATIS</h2>
          </div>

          <p class="bast-body-text">
            Pada hari <strong>${dateInfo.hari}, ${dateInfo.shortText}</strong> pukul ………….. telah diserahkan kembali alat makan sejumlah: <strong>${sasaranData.totalPorsi} paket</strong>.
            Paket makanan bergizi dari Satuan Pelayanan Pemenuhan Gizi Brebes Jatibarang Buaran.
          </p>

          <div class="bast-parties-grid">
            <div>
              <table class="bast-party-table">
                <tr><td style="width:110px;">Yang menyerahkan</td><td>: <strong>${item.NAMA_SURAT}</strong></td></tr>
                <tr><td>Nama PIC</td><td>: ${item.NAMA_PIC}</td></tr>
                <tr><td>No Telepon</td><td>: ${item.TELEPON_PIC}</td></tr>
              </table>
              <div class="bast-sign-line">(…………………………………..)</div>
            </div>
            <div>
              <table class="bast-party-table">
                <tr><td style="width:110px;">Diterima oleh</td><td>: <strong>${cfg.NAMA_SPPG_PENDEK}</strong></td></tr>
                <tr><td>Nama Driver</td><td>: ${drv.nama}</td></tr>
                <tr><td>No Telepon</td><td>: ${drv.telp}</td></tr>
              </table>
              <div class="bast-sign-line">(…………………………………..)</div>
            </div>
          </div>

          <div class="bast-knowing-title">Mengetahui,</div>
          <div class="bast-knowing-grid">
            <div>
              Kepala ${cfg.NAMA_SPPG_PENDEK}
              <div class="bast-knowing-space"></div>
              <strong>${cfg.KEPALA_SPPG}</strong>
            </div>
            <div>
              Koord Cuci Ompreng
              <div class="bast-knowing-space"></div>
              <strong>${cfg.KOORD_CUCI_OMPRENG}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- E. GENERATOR CHECKLIST UJI ORGANOLEPTIK ---
function generateOrganoleptikHTML(filterWilayah) {
  const cfg = appState.config;
  const dateInfo = parseDateInfo(cfg.TANGGAL_AKTIF);

  // Daftar lembaga untuk Organoleptik + 1 lembar internal SPPG Buaran
  const targets = appState.kpm
    .filter(k => k.STATUS_KPM !== 'MERGER_DAPODIK')
    .filter(k => filterWilayah === 'ALL' || k.WILAYAH === filterWilayah)
    .map(k => ({
      namaTempat: k.NAMA_ORGANOLEPTIK || k.NAMA_SURAT,
      statusWaktu: 'Sebelum dikonsumsi.',
      totalRows: 6
    }));

  // Tambahkan 1 lembar khusus internal SPPG Buaran
  targets.push({
    namaTempat: cfg.NAMA_SPPG_PENDEK || 'SPPG Buaran',
    statusWaktu: 'Sebelum pengantaran.',
    totalRows: 7
  });

  const activeMenus = appState.menu.filter(m => m.AKTIF && String(m.NAMA_MAKANAN).trim() !== '');

  return targets.map(t => {
    let rowsHtml = '';
    for (let i = 0; i < t.totalRows; i++) {
      const m = activeMenus[i];
      rowsHtml += `
        <tr>
          <td style="text-align:center;">${i + 1}.</td>
          <td>${m ? m.NAMA_MAKANAN : '&nbsp;'}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td style="text-align:center;">${i === 0 ? t.statusWaktu : ''}</td>
          <td></td>
        </tr>
      `;
    }

    return `
      <div class="print-sheet sheet-organo">
        <table class="organo-meta-table">
          <tr><td style="width:170px;">Nama Pemeriksa</td><td>: ........................................................................</td></tr>
          <tr><td>Tempat Pemeriksaan</td><td>: SPPG/Satuan Pendidikan/Posyandu/Lainnya</td></tr>
          <tr><td>Nama Tempat Pemeriksa</td><td>: <strong>${t.namaTempat}</strong></td></tr>
          <tr><td>Tanggal Pemeriksaan</td><td>: ${dateInfo.shortText}</td></tr>
          <tr><td>Waktu Pemeriksaan</td><td>: ........................................................................</td></tr>
        </table>

        <table class="tbl-organo">
          <thead>
            <tr>
              <th rowspan="2" style="width:32px;">No</th>
              <th rowspan="2">Nama Makanan</th>
              <th colspan="4">Hasil Pemeriksaan<br/>(diberi skor 1-5)</th>
              <th rowspan="2" style="width:150px;">Sebelum Pengantaran/<br/>Saat Tiba di Lokasi/<br/>Sebelum dikonsumsi</th>
              <th rowspan="2" style="width:65px;">Ket</th>
            </tr>
            <tr>
              <th style="width:48px;">Rasa</th>
              <th style="width:48px;">Warna</th>
              <th style="width:48px;">Aroma</th>
              <th style="width:48px;">Tekstur</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr>
              <td colspan="6" style="font-weight:700;">Kesimpulan Menu MBG</td>
              <td colspan="2" style="text-align:center;">
                <strong>Aman / Tidak aman dikonsumsi</strong><br/>
                <small><em>*coret tidak perlu</em></small>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="organo-notes">
          <strong>Catatan:</strong><br/>
          Silakan dipilih salah satu untuk pengisian hasil pelaksanaan uji organoleptik (Sebelum Pengantaran/Saat Tiba di Lokasi/Sebelum dikonsumsi).<br/>
          Form dibawa oleh sopir untuk diberikan ke penanggung jawab program MBG dan diambil kembali bersamaan dengan pengambilan ompreng MBG, dan dibawa kembali ke SPPG.
        </div>

        <div class="organo-score-box">
          <strong>Skor :</strong><br/>
          Sangat baik : 5 &nbsp;&nbsp;|&nbsp;&nbsp; Baik : 4 &nbsp;&nbsp;|&nbsp;&nbsp; Cukup : 3 &nbsp;&nbsp;|&nbsp;&nbsp; Kurang : 2 &nbsp;&nbsp;|&nbsp;&nbsp; Tidak baik : 1
        </div>

        <div style="text-align:right;margin-bottom:6px;">
          ${cfg.KOTA_SURAT || 'Brebes'}, ${dateInfo.shortText}
        </div>

        <div class="organo-sign-grid">
          <div>
            Mengetahui,<br/>
            Kepala ${cfg.NAMA_SPPG_PENDEK}
            <div style="height:55px;"></div>
            <strong><u>${cfg.KEPALA_SPPG}</u></strong>
          </div>
          <div>
            <br/>Pemeriksa,
            <div style="height:55px;"></div>
            ( .................................................... )
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 9. NAVIGASI TAB, MODAL & INTEGRASI API GOOGLE APPS SCRIPT (GAS MANDIRI)
// ============================================================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

function openApiModal() {
  document.getElementById('apiModal').style.display = 'flex';
}

function closeApiModal() {
  document.getElementById('apiModal').style.display = 'none';
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_LOGO, e.target.result);
    renderActivePrintPreview();
    alert('Logo Badan Gizi Nasional berhasil disimpan di browser!');
  };
  reader.readAsDataURL(file);
}

function saveApiSettings() {
  const url = document.getElementById('inpGasUrl').value.trim();
  if (url) {
    localStorage.setItem(STORAGE_KEYS.GAS_URL, url);
    closeApiModal();
    syncFromGAS();
  } else {
    localStorage.removeItem(STORAGE_KEYS.GAS_URL);
    setOnlineBadge(false, 'Mode Lokal (Default)');
    closeApiModal();
  }
}

function setOnlineBadge(isOnline, text) {
  const badge = document.getElementById('syncStatusBadge');
  badge.className = 'badge ' + (isOnline ? 'badge-online' : 'badge-offline');
  badge.textContent = text;
}

async function initDatabaseViaGAS() {
  const gasUrl = document.getElementById('inpGasUrl').value.trim();
  if (!gasUrl) {
    alert('Silakan tempelkan URL Web App GAS terlebih dahulu!');
    return;
  }
  try {
    setOnlineBadge(false, 'Membuat Database di GAS...');
    const res = await fetch(`${gasUrl}?action=setup`);
    const json = await res.json();
    if (json.status === 'success') {
      localStorage.setItem(STORAGE_KEYS.GAS_URL, gasUrl);
      alert('Berhasil! Spreadsheet baru telah dibuat di Google Drive Anda.');
      await syncFromGAS();
      closeApiModal();
    } else {
      alert('Gagal inisialisasi: ' + json.message);
    }
  } catch (err) {
    alert('Gagal menghubungi GAS: ' + err.message);
  }
}

async function syncFromGAS(silent = false) {
  const gasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL);
  if (!gasUrl) {
    if (!silent) openApiModal();
    return;
  }
  try {
    setOnlineBadge(false, 'Sinkronisasi GAS...');
    const res = await fetch(`${gasUrl}?action=getAllData`);
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      appState = Object.assign({}, DEFAULT_STATE, json.data);
      saveLocalState();
      bindAllUI();
      setOnlineBadge(true, 'Terhubung ke GAS Mandiri');
      if (!silent) alert('Data berhasil dimuat dari Google Spreadsheet!');
    } else {
      throw new Error(json.message || 'Respons tidak valid');
    }
  } catch (err) {
    setOnlineBadge(false, 'Offline (Data Lokal)');
    if (!silent) alert('Tidak dapat memuat dari GAS, menggunakan data lokal: ' + err.message);
  }
}

async function postToGAS(payload, successMsg) {
  const gasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL);
  saveLocalState();
  if (!gasUrl) {
    alert('Tersimpan di memori perangkat (LocalStorage). Hubungkan URL GAS jika ingin menyimpan ke Google Drive.');
    return;
  }
  try {
    setOnlineBadge(false, 'Menyimpan ke GAS...');
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.status === 'success') {
      if (json.penomoran) appState.penomoran = json.penomoran;
      saveLocalState();
      bindAllUI();
      setOnlineBadge(true, 'Tersimpan di GAS');
      alert(successMsg || json.message);
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    setOnlineBadge(false, 'Tersimpan Lokal (Gagal Sync)');
    alert('Data tersimpan di browser, namun gagal sinkron ke GAS: ' + err.message);
  }
}

function saveMenuAndConfigToGAS() {
  updateConfigFromUI();
  postToGAS({
    action: 'saveMenuAndConfig',
    config: appState.config,
    menu: appState.menu
  }, 'Menu Harian & Konfigurasi Pejabat berhasil disimpan!');
}

function saveKpmMasterToGAS() {
  postToGAS({
    action: 'saveKpmMaster',
    kpm: appState.kpm,
    posyanduPos: appState.posyanduPos
  }, 'Kuota Lapangan, Dapodik, & Rincian Posyandu berhasil disimpan!');
}

function lockAndSaveMonthlyNumbering() {
  const dateStr = document.getElementById('inpTanggal').value || '2026-10-16';
  const info = parseDateInfo(dateStr);
  const noAwal = Math.max(1, parseInt(document.getElementById('inpNoAwal').value || '1', 10));
  const activeCount = getActivePrintableInstitutions().length;
  const noAkhir = activeCount > 0 ? (noAwal + activeCount - 1) : noAwal;
  const menuRingkas = appState.menu
    .filter(m => m.AKTIF && m.NAMA_MAKANAN)
    .map(m => m.NAMA_MAKANAN)
    .join(', ');

  // Update state lokal terlebih dahulu
  const existingIdx = appState.penomoran.findIndex(r => String(r.TANGGAL_DISTRIBUSI) === dateStr);
  const logEntry = {
    ID_LOG: `LOG-${dateStr}`,
    PERIODE_BULAN: info.periodeBulan,
    TANGGAL_DISTRIBUSI: dateStr,
    BULAN_ROMAWI: info.bulanRomawi,
    NO_AWAL: noAwal,
    NO_AKHIR: noAkhir,
    JUMLAH_DOKUMEN: activeCount,
    MENU_RINGKAS: menuRingkas
  };

  if (existingIdx > -1) {
    appState.penomoran[existingIdx] = logEntry;
  } else {
    appState.penomoran.push(logEntry);
  }

  renderMonthlyLogTable(info.periodeBulan);

  postToGAS({
    action: 'saveMonthlyNumbering',
    tanggalDistribusi: dateStr,
    bulanRomawi: info.bulanRomawi,
    noAwal: noAwal,
    noAkhir: noAkhir,
    jumlahDokumen: activeCount,
    menuRingkas: menuRingkas
  }, `Penomoran tanggal ${dateStr} (${pad4(noAwal)} s/d ${pad4(noAkhir)}) berhasil dikunci!`);
}
