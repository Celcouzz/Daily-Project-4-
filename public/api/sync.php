<?php

header('Content-Type: application/json; charset=utf-8');

$config = require __DIR__ . '/../../app/Config/supabase.php';

$input = json_decode(file_get_contents('php://input'), true);
$rows = $input['rows'] ?? [];
$table = $input['table'] ?? $config['table'];

if (!$config['url'] || !$config['api_key']) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Supabase configuration is missing.']);
    exit;
}

if (!is_array($rows) || !$rows) {
    echo json_encode(['ok' => true, 'count' => 0]);
    exit;
}

$isValidatedRow = static function (array $row): bool {
    $validation = strtolower(trim((string)($row['validation'] ?? $row['Validation'] ?? '')));
    if ($validation === 'valid') {
        return true;
    }

    $sourceType = strtolower(trim((string)($row['source_type'] ?? $row['Source Type'] ?? $row['sourceType'] ?? '')));
    return $sourceType === 'validated';
};

$rows = array_values(array_filter($rows, $isValidatedRow));

if (!$rows) {
    echo json_encode(['ok' => true, 'count' => 0, 'message' => 'Tidak ada row valid untuk dikirim ke Supabase (raw disimpan lokal).']);
    exit;
}

$mapRow = static function (array $row): array {
    return [
        'NIM' => $row['nim'] ?? '',
        'Nama Lulusan' => $row['nama_lulusan'] ?? '',
        'Tahun Masuk' => $row['tahun_masuk'] ?? '',
        'Tanggal Lulus' => $row['tanggal_lulus'] ?? '',
        'Fakultas' => $row['fakultas'] ?? '',
        'Program Studi' => $row['program_studi'] ?? '',
        'Linkedin' => $row['linkedin'] ?? '',
        'Instagram' => $row['instagram'] ?? '',
        'Email' => $row['email'] ?? '',
        'Nomor HP' => $row['nomor_hp'] ?? '',
        'TikTok' => $row['tiktok'] ?? '',
        'Facebook' => $row['facebook'] ?? '',
        'Alamat Bekerja' => $row['alamat_bekerja'] ?? '',
        'Tempat Bekerja' => $row['tempat_bekerja'] ?? '',
        'Posisi Jabatan' => $row['posisi_jabatan'] ?? '',
        'Status Pekerjaan' => $row['status_pekerjaan'] ?? '',
        'Sosial Media Kantor' => $row['sosial_media_kantor'] ?? '',
        'Status Pencarian (Log)' => $row['status_pencarian_log'] ?? '',
        'Sumber File' => $row['sumber_file'] ?? '',
        'Asal File Asli' => $row['asal_file_asli'] ?? '',
        '__source_file' => $row['__source_file'] ?? '',
        'Email_norm' => $row['email_norm'] ?? '',
        'Status' => $row['status'] ?? 'Belum Terlacak',
        'Validation' => $row['validation'] ?? 'Raw',
        'Source Type' => $row['source_type'] ?? 'raw',
        'Updated At' => $row['updated_at'] ?? date('c'),
    ];
};

$payload = json_encode(array_map($mapRow, array_values($rows)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$endpoint = rtrim($config['url'], '/') . '/rest/v1/' . rawurlencode($table);

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Prefer: return=representation',
        'apikey: ' . $config['api_key'],
        'Authorization: Bearer ' . $config['api_key'],
    ],
    CURLOPT_POSTFIELDS => $payload,
]);

$response = curl_exec($ch);
$error = curl_error($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => $error]);
    exit;
}

if ($status < 200 || $status >= 300) {
    http_response_code($status ?: 500);
    echo json_encode(['ok' => false, 'message' => $response]);
    exit;
}

echo json_encode([
    'ok' => true,
    'count' => count($rows),
    'response' => json_decode($response, true),
]);
