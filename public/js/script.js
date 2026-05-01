document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    const authKey = 'alumni-umm-session';
    const apiBase = '../../public/api';
    const supabaseRead = typeof supabaseConfig !== 'undefined' ? supabaseConfig : {
        url: '',
        anonKey: '',
    };

    const setSession = (value) => {
        localStorage.setItem(authKey, value ? '1' : '0');
    };

    const hasSession = () => localStorage.getItem(authKey) === '1';

    const normalizeKey = (value) => String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

    const pickValue = (entryMap, patterns) => {
        for (const [key, value] of Object.entries(entryMap)) {
            if (patterns.some((pattern) => pattern.test(key)) && value !== undefined && value !== null && String(value).trim() !== '') {
                return value;
            }
        }
        return '';
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const normalizeNim = (value) => {
        const text = String(value || '').trim();
        if (!text) {
            return '';
        }

        if (!/[eE]/.test(text)) {
            return text.replace(/\.0+$/, '');
        }

        const compact = text.replace(/\s+/g, '').replace(/,/g, '.');
        const scientificMatch = compact.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);

        if (!scientificMatch) {
            return text;
        }

        const sign = scientificMatch[1] === '-' ? '-' : '';
        const integerPart = scientificMatch[2];
        const fractionalPart = scientificMatch[3] || '';
        const exponent = Number(scientificMatch[4]);

        if (!Number.isFinite(exponent)) {
            return text;
        }

        const digits = `${integerPart}${fractionalPart}`.replace(/^0+/, '') || '0';
        const decimalShift = exponent - fractionalPart.length;

        if (decimalShift >= 0) {
            return `${sign}${digits}${'0'.repeat(decimalShift)}`;
        }

        const splitPoint = digits.length + decimalShift;
        if (splitPoint <= 0) {
            return `${sign}0.${'0'.repeat(Math.abs(splitPoint))}${digits}`.replace(/\.?0+$/, '');
        }

        return `${sign}${digits.slice(0, splitPoint)}.${digits.slice(splitPoint)}`.replace(/\.?0+$/, '');
    };

    const normalizeValidationLabel = (row) => {
        const validation = String(row.validation || row.Validation || '').trim();
        const sourceType = String(row.source_type || row['Source Type'] || '').trim().toLowerCase();

        if (/^valid$/i.test(validation)) {
            return 'Valid';
        }

        if (sourceType === 'validated') {
            return 'Valid';
        }

        return validation || 'Belum Valid';
    };

    const isValidRow = (row) => String(row.validation || '').trim().toLowerCase() === 'valid';

    const getRowKey = (row) => {
        const nim = String(row.nim || '').trim();

        if (nim) {
            return `nim:${nim}`;
        }

        return [
            String(row.nama_lulusan || '').trim().toLowerCase(),
            String(row.tahun_masuk || '').trim().toLowerCase(),
            String(row.tanggal_lulus || '').trim().toLowerCase(),
        ].join('|');
    };

    const sortRows = (rows) => [...rows].sort((leftRow, rightRow) => {
        const validDiff = Number(isValidRow(rightRow)) - Number(isValidRow(leftRow));
        if (validDiff !== 0) {
            return validDiff;
        }

        const trackedDiff = Number(String(rightRow.status || '').trim().toLowerCase() === 'terlacak') - Number(String(leftRow.status || '').trim().toLowerCase() === 'terlacak');
        if (trackedDiff !== 0) {
            return trackedDiff;
        }

        return String(leftRow.nama_lulusan || '').localeCompare(String(rightRow.nama_lulusan || ''), 'id', { sensitivity: 'base' });
    });

    const normalizeRowsForDisplay = (rows) => sortRows(rows.map((row) => ({
        ...row,
        nim: normalizeNim(row.nim || row.NIM || ''),
        source_type: String(row.source_type || row['Source Type'] || '').trim().toLowerCase() || 'raw',
        validation: normalizeValidationLabel(row),
    })));

    const loadLocalRawRows = async () => {
        try {
            const indexResponse = await fetch('../../public/data/raw-alumni.json');
            if (!indexResponse.ok) return [];

            const index = await indexResponse.json();
            const chunkPromises = index.chunks.map(async (chunk) => {
                const response = await fetch(`../../public/data/${chunk}`);
                return response.ok ? response.json() : [];
            });

            const results = await Promise.all(chunkPromises);
            return results.flat().map(row => ({
                ...row,
                source_type: 'raw',
                validation: 'Belum Valid'
            }));
        } catch (e) {
            console.error('Gagal memuat data mentah:', e);
            return [];
        }
    };

    const fetchSupabaseRowsPaged = async () => {
        const pageSize = 1000;
        const rows = [];
        let offset = 0;

        while (true) {
            const response = await fetch(`${supabaseRead.url}/rest/v1/alumni?select=*&order=id.asc&limit=${pageSize}&offset=${offset}`, {
                headers: {
                    apikey: supabaseRead.anonKey,
                    Authorization: `Bearer ${supabaseRead.anonKey}`,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Gagal mengambil data Supabase');
            }

            const pageRows = await response.json();
            if (!pageRows.length) {
                break;
            }

            rows.push(...pageRows);

            if (pageRows.length < pageSize) {
                break;
            }

            offset += pageSize;
        }

        return rows;
    };

    const normalizeRows = (rows, sourceType) => rows.map((row) => {
        const entryMap = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
        const namaLulusan = pickValue(entryMap, [/nama/, /name/]);
        const nim = pickValue(entryMap, [/nim/, /nrp/, /studentid/, /nomorinduk/]);
        const tahunMasuk = pickValue(entryMap, [/tahunmasuk/, /thnmasuk/, /angkatan/, /tahun/]);
        const tanggalLulus = pickValue(entryMap, [/tanggallulus/, /graduationdate/, /tgl/]);
        const fakultas = pickValue(entryMap, [/fakultas/, /faculty/]);
        const programStudi = pickValue(entryMap, [/prodi/, /programstudi/, /jurusan/]);
        const linkedin = pickValue(entryMap, [/linkedin/]);
        const instagram = pickValue(entryMap, [/instagram/, /ig/]);
        const email = pickValue(entryMap, [/email/]);
        const nomorHp = pickValue(entryMap, [/nomorhp/, /nohp/, /phone/, /telepon/, /handphone/]);
        const tiktok = pickValue(entryMap, [/tiktok/]);
        const facebook = pickValue(entryMap, [/facebook/]);
        const alamatBekerja = pickValue(entryMap, [/alamatbekerja/, /alamatkantor/, /workaddress/]);
        const tempatBekerja = pickValue(entryMap, [/tempatbekerja/, /instansi/, /perusahaan/, /company/]);
        const posisiJabatan = pickValue(entryMap, [/posisijabatan/, /jabatan/, /position/]);
        const statusPekerjaan = pickValue(entryMap, [/statuspekerjaan/, /pekerjaan/, /jobstatus/]) || (sourceType === 'validated' ? 'Swasta' : 'Belum Terlacak');
        const sosialMediaKantor = pickValue(entryMap, [/socialmediakantor/, /sosialmediakantor/, /kantorsocial/]);
        const statusPencarianLog = pickValue(entryMap, [/statuspencarianlog/, /statuspencarian/, /log/]) || (sourceType === 'validated' ? 'Sukses (Terverifikasi UMM)' : 'Belum Diproses');
        const status = pickValue(entryMap, [/status/]) || (statusPekerjaan !== 'Belum Terlacak' ? 'Terlacak' : 'Belum Terlacak');
        const validation = pickValue(entryMap, [/validasi/, /validation/]) || (sourceType === 'validated' ? 'Valid' : 'Belum Valid');

        return {
            nama_lulusan: String(namaLulusan || '').trim(),
            nim: String(nim || '').trim(),
            tahun_masuk: String(tahunMasuk || '').trim(),
            tanggal_lulus: String(tanggalLulus || '').trim(),
            fakultas: String(fakultas || '').trim(),
            program_studi: String(programStudi || '').trim(),
            linkedin: String(linkedin || '').trim(),
            instagram: String(instagram || '').trim(),
            email: String(email || '').trim(),
            nomor_hp: String(nomorHp || '').trim(),
            tiktok: String(tiktok || '').trim(),
            facebook: String(facebook || '').trim(),
            alamat_bekerja: String(alamatBekerja || '').trim(),
            tempat_bekerja: String(tempatBekerja || '').trim(),
            posisi_jabatan: String(posisiJabatan || '').trim(),
            status_pekerjaan: String(statusPekerjaan || 'Belum Terlacak').trim(),
            sosial_media_kantor: String(sosialMediaKantor || '').trim(),
            status_pencarian_log: String(statusPencarianLog || '').trim(),
            status: String(status || '').trim() || 'Belum Terlacak',
            validation: String(validation || '').trim() || (sourceType === 'validated' ? 'Valid' : 'Belum Valid'),
            source_type: sourceType,
        };
    }).filter((row) => row.nama_lulusan || row.nim);

    const parseExcelFile = async (file, sourceType) => {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        return normalizeRows(rawRows, sourceType);
    };

    const mergeByNim = (rawRows, validatedRows) => {
        const mergedMap = new Map();

        const upsertRow = (row, sourceType) => {
            const nimKey = String(row.nim || '').trim() || `${String(row.nama_lulusan || '').trim()}-${String(row.tahun_masuk || '').trim()}`;
            const existing = mergedMap.get(nimKey);
            const nextRow = {
                ...existing,
                ...row,
                source_type: sourceType,
            };

            if (sourceType === 'validated') {
                nextRow.validation = 'Valid';
            } else {
                nextRow.validation = normalizeValidationLabel(nextRow);
            }

            mergedMap.set(nimKey, nextRow);
        };

        rawRows.forEach((row) => upsertRow(row, 'raw'));
        validatedRows.forEach((row) => upsertRow(row, 'validated'));

        return Array.from(mergedMap.values()).map((row) => ({
            ...row,
            source_type: row.source_type || 'raw',
            validation: normalizeValidationLabel(row),
        }));
    };

    const sendRowsToBackend = async (rows) => {
        const response = await fetch(`${apiBase}/sync.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rows }),
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
            throw new Error(result.message || 'Gagal sinkron ke backend');
        }

        return result;
    };

    const fetchRowsFromBackend = async () => {
        try {
            const response = await fetch(`${apiBase}/alumni.php`);
            const result = await response.json();

            if (!response.ok || !result.ok) {
                throw new Error(result.message || 'Gagal mengambil data backend');
            }

            const validatedRows = normalizeRowsForDisplay((result.data || []).map((row) => ({
                ...row,
                validation: normalizeValidationLabel(row),
                source_type: 'validated',
            })));
            return validatedRows;
        } catch (backendError) {
            const rows = await fetchSupabaseRowsPaged();
            const validatedRows = normalizeRowsForDisplay(rows.map((row) => ({
                nim: row.NIM || '',
                nama_lulusan: row['Nama Lulusan'] || '',
                tahun_masuk: row['Tahun Masuk'] || '',
                tanggal_lulus: row['Tanggal Lulus'] || '',
                fakultas: row['Fakultas'] || '',
                program_studi: row['Program Studi'] || '',
                linkedin: row.Linkedin || '',
                instagram: row.Instagram || '',
                email: row.Email || '',
                nomor_hp: row['Nomor HP'] || '',
                tiktok: row.TikTok || '',
                facebook: row.Facebook || '',
                alamat_bekerja: row['Alamat Bekerja'] || '',
                tempat_bekerja: row['Tempat Bekerja'] || '',
                posisi_jabatan: row['Posisi Jabatan'] || '',
                status_pekerjaan: row['Status Pekerjaan'] || '',
                sosial_media_kantor: row['Sosial Media Kantor'] || '',
                status_pencarian_log: row['Status Pencarian (Log)'] || '',
                status: row.Status || '',
                validation: normalizeValidationLabel(row),
                source_type: 'validated',
            })));
            return validatedRows;
        }
    };

    const renderTable = (rows) => {
        const tableBody = document.querySelector('#combinedTable tbody');
        if (!tableBody) {
            return;
        }

        const searchInput = document.getElementById('combinedSearch');
        const statusFilter = document.getElementById('statusFilter');
        const yearFilter = document.getElementById('yearFilter');
        const validationFilter = document.getElementById('validationFilter');
        const onlyTracked = document.getElementById('showOnlyTracked');
        const onlyValidated = document.getElementById('showOnlyValidated');
        const refreshButton = document.getElementById('refreshButton');
        const prevPageButton = document.getElementById('prevPageButton');
        const nextPageButton = document.getElementById('nextPageButton');
        const pageInfo = document.getElementById('pageInfo');
        const rowsPerPage = 100;
        let currentPage = 1;
        let filteredRows = rows;

        const fillOptions = (select, values) => {
            if (!select || select.options.length > 1) {
                return;
            }

            values.forEach((value) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });
        };

        fillOptions(statusFilter, [...new Set(rows.map((row) => row.status).filter(Boolean))]);
        fillOptions(yearFilter, [...new Set(rows.map((row) => row.tahun_masuk).filter(Boolean))]);

        const totalCount = document.getElementById('totalCount');
        const trackedCount = document.getElementById('trackedCount');
        const untrackedCount = document.getElementById('untrackedCount');
        const validatedCount = document.getElementById('validatedCount');

        const updateSummary = (items) => {
            if (!totalCount || !trackedCount || !untrackedCount || !validatedCount) {
                return;
            }

            const totalBase = 142293;
            const validated = items.filter((row) => isValidRow(row)).length;
            const tracked = validated;
            const untracked = Math.max(totalBase - tracked, 0);

            totalCount.textContent = totalBase.toLocaleString('id-ID');
            trackedCount.textContent = tracked.toLocaleString('id-ID');
            untrackedCount.textContent = untracked.toLocaleString('id-ID');
            validatedCount.textContent = validated.toLocaleString('id-ID');
        };

        const renderPage = () => {
            const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
            currentPage = Math.min(Math.max(currentPage, 1), totalPages);
            const startIndex = (currentPage - 1) * rowsPerPage;
            const visibleRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

            if (pageInfo) {
                if (!filteredRows.length) {
                    pageInfo.textContent = 'Tidak ada data untuk ditampilkan.';
                } else {
                    pageInfo.textContent = `Menampilkan ${startIndex + 1}-${Math.min(startIndex + rowsPerPage, filteredRows.length)} dari ${filteredRows.length} data unik`;
                }
            }

            if (prevPageButton) {
                prevPageButton.disabled = currentPage <= 1;
            }

            if (nextPageButton) {
                nextPageButton.disabled = currentPage >= totalPages;
            }

            if (!visibleRows.length) {
                tableBody.innerHTML = '<tr><td colspan="7" class="empty-row">Data tidak ditemukan.</td></tr>';
                return;
            }

            tableBody.innerHTML = visibleRows.map((row, index) => `
                <tr>
                    <td>${escapeHtml(row.nama_lulusan || '-')}</td>
                    <td>${escapeHtml(row.nim || '-')}</td>
                    <td>${escapeHtml(row.tahun_masuk || '-')}</td>
                    <td>${escapeHtml(row.tanggal_lulus || '-')}</td>
                    <td>${escapeHtml(row.program_studi || '-')}</td>
                    <td>${escapeHtml(row.status_pencarian_log || '-')}</td>
                    <td class="text-center">
                        <button class="ghost-button small-button view-detail" type="button" data-index="${startIndex + index}">Detail</button>
                    </td>
                </tr>
            `).join('');
        };

        // Pre-compute properties for all rows to make filtering and sorting much faster
        rows.forEach(row => {
            if (row._processed) return;
            
            // Normalize status based on search log to ensure consistency
            const searchLog = String(row.status_pencarian_log || '').toLowerCase();
            if (searchLog.includes('sukses') || searchLog.includes('terverifikasi')) {
                row.status = 'Terlacak';
            }

            row.searchString = [
                row.nama_lulusan,
                row.nim,
                row.tahun_masuk,
                row.program_studi,
                row.status_pencarian_log,
                row.status,
                row.validation,
            ].join(' ').toLowerCase();

            row._isValid = isValidRow(row);
            row._sortName = String(row.nama_lulusan || '').toLowerCase();
            row._processed = true;
        });

        const filterAndRender = () => {
            const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const selectedStatus = statusFilter ? statusFilter.value : '';
            const selectedYear = yearFilter ? yearFilter.value : '';
            const selectedValidation = validationFilter ? validationFilter.value : '';
            const trackedOnly = onlyTracked ? onlyTracked.checked : false;
            const validatedOnly = onlyValidated ? onlyValidated.checked : false;

            filteredRows = rows.filter((row) => {
                const matchesKeyword = !keyword || row.searchString.includes(keyword);
                const matchesStatus = !selectedStatus || row.status === selectedStatus;
                const matchesYear = !selectedYear || String(row.tahun_masuk) === String(selectedYear);
                const matchesValidation = !selectedValidation || String(row.validation).toLowerCase() === selectedValidation;
                const matchesTracked = !trackedOnly || String(row.status || '').trim().toLowerCase() === 'terlacak';
                const matchesValidated = !validatedOnly || row._isValid;
                return matchesKeyword && matchesStatus && matchesYear && matchesValidation && matchesTracked && matchesValidated;
            }).sort((a, b) => (b._isValid - a._isValid) || a._sortName.localeCompare(b._sortName, 'id'));

            currentPage = 1;
            updateSummary(filteredRows);
            renderPage();
        };

        // Debounce mechanism
        let filterTimeout;
        const debouncedFilter = () => {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(filterAndRender, 300);
        };

        [searchInput, statusFilter, yearFilter, validationFilter, onlyTracked, onlyValidated].forEach((element) => {
            if (!element) return;

            const eventName = element.type === 'checkbox' ? 'change' : 'input';
            const handler = (element === searchInput) ? debouncedFilter : filterAndRender;
            element.addEventListener(eventName, handler);
        });

        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                filterAndRender();
            });
        }

        if (prevPageButton) {
            prevPageButton.addEventListener('click', () => {
                currentPage -= 1;
                renderPage();
            });
        }

        if (nextPageButton) {
            nextPageButton.addEventListener('click', () => {
                currentPage += 1;
                renderPage();
            });
        }

        const showDetailModal = (row) => {
            const modal = document.getElementById('detailModal');
            const title = document.getElementById('modalTitle');
            const grid = document.getElementById('modalGrid');

            if (!modal || !title || !grid) return;

            title.textContent = row.nama_lulusan || 'Detail Alumni';

            const fields = [
                { label: 'LinkedIn', value: row.linkedin },
                { label: 'Instagram', value: row.instagram },
                { label: 'Email', value: row.email },
                { label: 'Nomor HP', value: row.nomor_hp },
                { label: 'TikTok', value: row.tiktok },
                { label: 'Facebook', value: row.facebook },
                { label: 'Alamat Bekerja', value: row.alamat_bekerja },
                { label: 'Tempat Bekerja', value: row.tempat_bekerja },
                { label: 'Posisi Jabatan', value: row.posisi_jabatan },
                { label: 'Status Pekerjaan', value: row.status_pekerjaan },
                { label: 'Sosial Media Kantor', value: row.sosial_media_kantor },
            ];

            const formatValue = (label, value) => {
                const text = String(value || '').trim();
                if (!text || text === '-' || text === '[]') return '-';

                // Check for email
                if (label.toLowerCase().includes('email') && text.includes('@')) {
                    return `<a href="mailto:${text}" class="detail-link">${escapeHtml(text)}</a>`;
                }

                // Check for URL
                if (text.startsWith('http') || text.includes('www.')) {
                    let url = text;
                    if (!url.startsWith('http')) url = 'https://' + url;
                    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="detail-link">${escapeHtml(text)}</a>`;
                }

                return escapeHtml(text);
            };

            grid.innerHTML = fields.map(field => `
                <div class="detail-item">
                    <span>${field.label}</span>
                    <strong>${formatValue(field.label, field.value)}</strong>
                </div>
            `).join('');

            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        };

        const hideDetailModal = () => {
            const modal = document.getElementById('detailModal');
            if (modal) {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        };

        tableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-detail');
            if (btn) {
                const index = parseInt(btn.dataset.index);
                const row = filteredRows[index];
                if (row) {
                    showDetailModal(row);
                }
            }
        });

        document.getElementById('closeModal')?.addEventListener('click', hideDetailModal);
        document.getElementById('detailModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'detailModal') hideDetailModal();
        });

        filterAndRender();
    };

    const setupLogin = () => {
        const loginButton = document.getElementById('loginButton');
        const authMessage = document.getElementById('authMessage');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        if (!loginButton) {
            return;
        }

        if (hasSession()) {
            window.location.href = 'dashboard.html';
            return;
        }

        loginButton.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (username !== 'admin' || password !== 'umm123') {
                authMessage.textContent = 'Username atau password salah. Coba admin / umm123.';
                return;
            }

            loginButton.disabled = true;
            loginButton.textContent = 'Menghubungkan...';

            // Artificial delay for premium feel
            await new Promise(r => setTimeout(r, 800));

            setSession(true);
            window.location.href = 'dashboard.html';
        });

        [usernameInput, passwordInput].forEach((input) => {
            if (!input) {
                return;
            }

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    loginButton.click();
                }
            });
        });
    };

    const setupDashboard = async () => {
        const logoutButton = document.getElementById('logoutButton');
        const sessionOverlay = document.getElementById('sessionOverlay');
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('main section[id]');

        if (!hasSession()) {
            sessionOverlay?.classList.remove('hidden');
            return;
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                setSession(false);
                window.location.href = 'index.html';
            });
        }

        const setActiveNav = () => {
            const offset = window.scrollY + 140;

            sections.forEach((section) => {
                const top = section.offsetTop;
                const bottom = top + section.offsetHeight;

                if (offset >= top && offset < bottom) {
                    navItems.forEach((item) => item.classList.remove('active'));
                    const activeItem = document.querySelector(`.nav-item[href="#${section.id}"]`);
                    if (activeItem) {
                        activeItem.classList.add('active');
                    }
                }
            });
        };

        window.addEventListener('scroll', setActiveNav);
        setActiveNav();

        try {
            const [validatedRows, rawRows] = await Promise.all([
                fetchRowsFromBackend(),
                loadLocalRawRows()
            ]);

            const combinedRows = mergeByNim(rawRows, validatedRows);
            renderTable(combinedRows);
        } catch (error) {
            console.error('Gagal memuat data:', error);
            const tableBody = document.querySelector('#combinedTable tbody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="7" class="empty-row">Gagal memuat data gabungan.</td></tr>';
            }
        }
    };

    if (page === 'login') {
        setupLogin();
    }

    if (page === 'dashboard') {
        setupDashboard();
    }
});
