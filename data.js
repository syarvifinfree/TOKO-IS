// ===== CONFIG =====
const MK = '$2a$10$27kPGVF/AiprhGJmtAKEt.ha8En9/Vr6kKYSKaTv06LdqQS/sbkfe';
const API = 'https://api.jsonbin.io/v3/b';
const PIN = '8888';
const LS_BIN_ITEMS = 'stokis_bin_items_id';
const LS_BIN_TX = 'stokis_bin_tx_id';
const LS_AUTH = 'stokis_auth_ok';

const KATEGORI_LIST = ['MINUMAN','ROKOK','BAHAN','MAKANAN'];

const INITIAL_ITEMS = [
  {
    "id": "i001_adem_sari",
    "nama": "ADEM SARI",
    "kategori": "MINUMAN",
    "stokIdle": 24,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 30
  },
  {
    "id": "i002_aqua_1_5",
    "nama": "AQUA 1.5",
    "kategori": "MINUMAN",
    "stokIdle": 48,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 20
  },
  {
    "id": "i003_aqua_600",
    "nama": "AQUA 600",
    "kategori": "MINUMAN",
    "stokIdle": 96,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 4
  },
  {
    "id": "i004_chocolatos_coklat",
    "nama": "CHOCOLATOS COKLAT",
    "kategori": "MINUMAN",
    "stokIdle": 30,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i005_chocolatos_matcha",
    "nama": "CHOCOLATOS MATCHA",
    "kategori": "MINUMAN",
    "stokIdle": 20,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i006_coffeemix",
    "nama": "COFFEEMIX",
    "kategori": "MINUMAN",
    "stokIdle": 100,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 22
  },
  {
    "id": "i007_energen_coklat",
    "nama": "ENERGEN COKLAT",
    "kategori": "MINUMAN",
    "stokIdle": 20,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 8
  },
  {
    "id": "i008_energen_kacang_hijau",
    "nama": "ENERGEN KACANG HIJAU",
    "kategori": "MINUMAN",
    "stokIdle": 20,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 12
  },
  {
    "id": "i009_extrajoss",
    "nama": "EXTRAJOSS",
    "kategori": "MINUMAN",
    "stokIdle": 60,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 44
  },
  {
    "id": "i010_kukubima",
    "nama": "KUKUBIMA",
    "kategori": "MINUMAN",
    "stokIdle": 30,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 45
  },
  {
    "id": "i011_feloz_sultan",
    "nama": "FELOZ SULTAN",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 2
  },
  {
    "id": "i012_gp_gudang_garam",
    "nama": "GP/GUDANG GARAM",
    "kategori": "ROKOK",
    "stokIdle": 3,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i013_gula",
    "nama": "GULA",
    "kategori": "BAHAN",
    "stokIdle": 5,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 1
  },
  {
    "id": "i014_indocafe_cappuccino",
    "nama": "INDOCAFE CAPPUCCINO",
    "kategori": "MINUMAN",
    "stokIdle": 50,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 64
  },
  {
    "id": "i015_indomie_goreng",
    "nama": "INDOMIE GORENG",
    "kategori": "MAKANAN",
    "stokIdle": 80,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 9
  },
  {
    "id": "i016_indomie_kari_ayam",
    "nama": "INDOMIE KARI AYAM",
    "kategori": "MAKANAN",
    "stokIdle": 80,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 3
  },
  {
    "id": "i017_kopi_ginseng",
    "nama": "KOPI GINSENG",
    "kategori": "MINUMAN",
    "stokIdle": 40,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 1
  },
  {
    "id": "i018_lasegar_kaleng",
    "nama": "LASEGAR KALENG",
    "kategori": "MINUMAN",
    "stokIdle": 24,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 4
  },
  {
    "id": "i019_lucky_strike",
    "nama": "LUCKY STRIKE",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 3
  },
  {
    "id": "i020_luffman",
    "nama": "LUFFMAN",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 9
  },
  {
    "id": "i021_m150",
    "nama": "M150",
    "kategori": "MINUMAN",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i022_mama_lemon",
    "nama": "MAMA LEMON",
    "kategori": "BAHAN",
    "stokIdle": 5,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 2
  },
  {
    "id": "i023_manchester_merah",
    "nama": "MANCHESTER MERAH",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i024_manchester_putih",
    "nama": "MANCHESTER PUTIH",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i025_marlong_16",
    "nama": "MARLONG 16",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i026_milku",
    "nama": "MILKU",
    "kategori": "MINUMAN",
    "stokIdle": 12,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i027_milo",
    "nama": "MILO",
    "kategori": "MINUMAN",
    "stokIdle": 30,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i028_minyak_goreng",
    "nama": "MINYAK GORENG",
    "kategori": "BAHAN",
    "stokIdle": 12,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 4
  },
  {
    "id": "i029_nutriboost",
    "nama": "NUTRIBOOST",
    "kategori": "MINUMAN",
    "stokIdle": 12,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 1
  },
  {
    "id": "i030_nutrisari_mangga",
    "nama": "NUTRISARI MANGGA",
    "kategori": "MINUMAN",
    "stokIdle": 40,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 37
  },
  {
    "id": "i031_nutrisari_jeruk_nipis",
    "nama": "NUTRISARI JERUK NIPIS",
    "kategori": "MINUMAN",
    "stokIdle": 40,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i032_nutrisari_jeruk_peras",
    "nama": "NUTRISARI JERUK PERAS",
    "kategori": "MINUMAN",
    "stokIdle": 40,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 25
  },
  {
    "id": "i033_pop_mie_goreng",
    "nama": "POP MIE GORENG",
    "kategori": "MAKANAN",
    "stokIdle": 24,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 11
  },
  {
    "id": "i034_pop_mie_kuah",
    "nama": "POP MIE KUAH",
    "kategori": "MAKANAN",
    "stokIdle": 24,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i035_pop_mie_pedes_dower",
    "nama": "POP MIE PEDES DOWER",
    "kategori": "MAKANAN",
    "stokIdle": 12,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i036_pop_mie_pedes_gledek",
    "nama": "POP MIE PEDES GLEDEK",
    "kategori": "MAKANAN",
    "stokIdle": 12,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 1
  },
  {
    "id": "i037_sabun_ekonomi",
    "nama": "SABUN EKONOMI",
    "kategori": "BAHAN",
    "stokIdle": 5,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i038_sampoerna_besar",
    "nama": "SAMPOERNA BESAR",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i039_sampoerna_hijau",
    "nama": "SAMPOERNA HIJAU",
    "kategori": "ROKOK",
    "stokIdle": 5,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 2
  },
  {
    "id": "i040_sampoerna_kecil",
    "nama": "SAMPOERNA KECIL",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 1
  },
  {
    "id": "i041_samsue_kuning",
    "nama": "SAMSUE KUNING",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i042_samsue_refill_hitam",
    "nama": "SAMSUE REFILL/HITAM",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 2
  },
  {
    "id": "i043_sky",
    "nama": "SKY",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i044_surya_besar",
    "nama": "SURYA BESAR",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 4
  },
  {
    "id": "i045_surya_kecil",
    "nama": "SURYA KECIL",
    "kategori": "ROKOK",
    "stokIdle": 10,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i046_teh_perenjak",
    "nama": "TEH PERENJAK",
    "kategori": "MINUMAN",
    "stokIdle": 5,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 1
  },
  {
    "id": "i047_teh_pucuk",
    "nama": "TEH PUCUK",
    "kategori": "MINUMAN",
    "stokIdle": 24,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 0
  },
  {
    "id": "i048_teh_tarik",
    "nama": "TEH TARIK",
    "kategori": "MINUMAN",
    "stokIdle": 50,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 20
  },
  {
    "id": "i049_torabika_capuccino",
    "nama": "TORABIKA CAPUCCINO",
    "kategori": "MINUMAN",
    "stokIdle": 30,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 27
  },
  {
    "id": "i050_surya_kaleng",
    "nama": "SURYA KALENG",
    "kategori": "ROKOK",
    "stokIdle": 50,
    "packSize": 1,
    "modalSatuan": 0,
    "stokSaatIni": 11
  }
];

