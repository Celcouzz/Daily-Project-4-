<?php

header('Content-Type: application/json; charset=utf-8');

$config = require __DIR__ . '/../../app/Config/supabase.php';

if (!$config['url'] || !$config['api_key']) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Supabase configuration is missing.']);
    exit;
}

$rows = [];
$pageSize = 1000;
$offset = 0;
$endpointBase = rtrim($config['url'], '/') . '/rest/v1/alumni';

while (true) {
    $endpoint = $endpointBase . '?select=*&order=id.asc&limit=' . $pageSize . '&offset=' . $offset;
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'apikey: ' . $config['api_key'],
            'Authorization: Bearer ' . $config['api_key'],
            'Accept: application/json',
        ],
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

    $pageRows = json_decode($response, true) ?: [];

    if (!$pageRows) {
        break;
    }

    $rows = array_merge($rows, $pageRows);

    if (count($pageRows) < $pageSize) {
        break;
    }

    $offset += $pageSize;
}

if (!$rows) {
    echo json_encode(['ok' => true, 'data' => []]);
    exit;
}

$normalized = array_map(static function (array $row): array {
    $validation = $row['Validation'] ?? '';
    $sourceType = $row['Source Type'] ?? '';
    $normalizedValidation = strtolower(trim((string) $validation));
    $normalizedSourceType = strtolower(trim((string) $sourceType));

    if ($normalizedValidation === '' || $normalizedSourceType === 'validated') {
        $validation = 'Valid';
    }

    return [
        'nim' => $row['NIM'] ?? '',
        'nama_lulusan' => $row['Nama Lulusan'] ?? '',
        'tahun_masuk' => $row['Tahun Masuk'] ?? '',
        'tanggal_lulus' => $row['Tanggal Lulus'] ?? '',
        'fakultas' => $row['Fakultas'] ?? '',
        'program_studi' => $row['Program Studi'] ?? '',
        'linkedin' => $row['Linkedin'] ?? '',
        'instagram' => $row['Instagram'] ?? '',
        'email' => $row['Email'] ?? '',
        'nomor_hp' => $row['Nomor HP'] ?? '',
        'tiktok' => $row['TikTok'] ?? '',
        'facebook' => $row['Facebook'] ?? '',
        'alamat_bekerja' => $row['Alamat Bekerja'] ?? '',
        'tempat_bekerja' => $row['Tempat Bekerja'] ?? '',
        'posisi_jabatan' => $row['Posisi Jabatan'] ?? '',
        'status_pekerjaan' => $row['Status Pekerjaan'] ?? '',
        'sosial_media_kantor' => $row['Sosial Media Kantor'] ?? '',
        'status_pencarian_log' => $row['Status Pencarian (Log)'] ?? '',
        'sumber_file' => $row['Sumber File'] ?? '',
        'asal_file_asli' => $row['Asal File Asli'] ?? '',
        '__source_file' => $row['__source_file'] ?? '',
        'email_norm' => $row['Email_norm'] ?? '',
        'status' => $row['Status'] ?? '',
        'validation' => $validation ?: ($normalizedSourceType === 'validated' ? 'Valid' : ''),
        'source_type' => $sourceType,
        'updated_at' => $row['Updated At'] ?? '',
    ];
}, $rows);

echo json_encode([
    'ok' => true,
    'data' => $normalized,
]);
