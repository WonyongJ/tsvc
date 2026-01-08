// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class PDFMerger {
    constructor() {
        this.pdfs = [];
        this.selectedPages = [];
        this.init();
    }

    init() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const mergeBtn = document.getElementById('mergeBtn');
        const clearBtn = document.getElementById('clearBtn');

        // 파일 입력 클릭
        uploadArea.addEventListener('click', () => fileInput.click());

        // 파일 선택
        fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // 드래그 앤 드롭
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // 병합 버튼
        mergeBtn.addEventListener('click', () => this.mergePDFs());

        // 지우기 버튼
        clearBtn.addEventListener('click', () => this.clearAll());
    }

    async handleFiles(files) {
        const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
        
        if (pdfFiles.length === 0) {
            alert('PDF 파일만 업로드할 수 있습니다.');
            return;
        }

        for (const file of pdfFiles) {
            await this.loadPDF(file);
        }

        this.updateButtons();
    }

    async loadPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const pdfData = {
            id: Date.now() + Math.random(),
            name: file.name,
            file: file,
            pdf: pdf,
            numPages: pdf.numPages,
            pages: []
        };

        this.pdfs.push(pdfData);
        await this.renderPDF(pdfData);
    }

    async renderPDF(pdfData) {
        const pdfList = document.getElementById('pdfList');
        const pdfItem = document.createElement('div');
        pdfItem.className = 'pdf-item';
        pdfItem.id = `pdf-${pdfData.id}`;

        const pagesGrid = document.createElement('div');
        pagesGrid.className = 'pages-grid';

        pdfItem.innerHTML = `
            <div class="pdf-header">
                <div class="pdf-title">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                    <span>${pdfData.name}</span>
                    <span style="color: #666; font-size: 0.9rem;">(${pdfData.numPages}페이지)</span>
                </div>
                <button class="remove-btn" onclick="pdfMerger.removePDF(${pdfData.id})">제거</button>
            </div>
            <div class="page-actions">
                <button class="page-action-btn" onclick="pdfMerger.selectAllPages(${pdfData.id})">전체 선택</button>
                <button class="page-action-btn" onclick="pdfMerger.deselectAllPages(${pdfData.id})">전체 해제</button>
            </div>
        `;

        pdfItem.appendChild(pagesGrid);

        // 페이지 썸네일 렌더링
        for (let pageNum = 1; pageNum <= pdfData.numPages; pageNum++) {
            const page = await pdfData.pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const pageThumbnail = document.createElement('div');
            pageThumbnail.className = 'page-thumbnail';
            pageThumbnail.dataset.pdfId = pdfData.id;
            pageThumbnail.dataset.pageNum = pageNum;
            pageThumbnail.onclick = () => this.togglePageSelection(pdfData.id, pageNum);

            pageThumbnail.appendChild(canvas);
            
            const pageNumber = document.createElement('div');
            pageNumber.className = 'page-number';
            pageNumber.textContent = `페이지 ${pageNum}`;
            pageThumbnail.appendChild(pageNumber);

            pagesGrid.appendChild(pageThumbnail);

            pdfData.pages.push({
                pageNum: pageNum,
                page: page,
                element: pageThumbnail
            });
        }

        pdfList.appendChild(pdfItem);
    }

    togglePageSelection(pdfId, pageNum) {
        const pdfData = this.pdfs.find(p => p.id === pdfId);
        if (!pdfData) return;

        const pageElement = pdfData.pages.find(p => p.pageNum === pageNum)?.element;
        if (!pageElement) return;

        const isSelected = pageElement.classList.contains('selected');
        
        if (isSelected) {
            pageElement.classList.remove('selected');
            this.selectedPages = this.selectedPages.filter(
                p => !(p.pdfId === pdfId && p.pageNum === pageNum)
            );
        } else {
            pageElement.classList.add('selected');
            this.selectedPages.push({ pdfId, pageNum });
        }

        this.updateButtons();
    }

    selectAllPages(pdfId) {
        const pdfData = this.pdfs.find(p => p.id === pdfId);
        if (!pdfData) return;

        pdfData.pages.forEach(page => {
            if (!page.element.classList.contains('selected')) {
                page.element.classList.add('selected');
                const exists = this.selectedPages.some(
                    p => p.pdfId === pdfId && p.pageNum === page.pageNum
                );
                if (!exists) {
                    this.selectedPages.push({ pdfId, pageNum: page.pageNum });
                }
            }
        });

        this.updateButtons();
    }

    deselectAllPages(pdfId) {
        const pdfData = this.pdfs.find(p => p.id === pdfId);
        if (!pdfData) return;

        pdfData.pages.forEach(page => {
            page.element.classList.remove('selected');
        });

        this.selectedPages = this.selectedPages.filter(p => p.pdfId !== pdfId);
        this.updateButtons();
    }

    removePDF(pdfId) {
        this.pdfs = this.pdfs.filter(p => p.id !== pdfId);
        this.selectedPages = this.selectedPages.filter(p => p.pdfId !== pdfId);
        
        const pdfItem = document.getElementById(`pdf-${pdfId}`);
        if (pdfItem) {
            pdfItem.remove();
        }

        this.updateButtons();
    }

    updateButtons() {
        const mergeBtn = document.getElementById('mergeBtn');
        const clearBtn = document.getElementById('clearBtn');
        
        mergeBtn.disabled = this.selectedPages.length === 0;
        clearBtn.disabled = this.pdfs.length === 0;
    }

    async mergePDFs() {
        if (this.selectedPages.length === 0) {
            alert('병합할 페이지를 선택해주세요.');
            return;
        }

        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';

        try {
            const { PDFDocument } = PDFLib;
            const mergedPdf = await PDFDocument.create();

            const totalPages = this.selectedPages.length;
            let processed = 0;

            // 선택된 페이지를 순서대로 병합
            for (const { pdfId, pageNum } of this.selectedPages) {
                const pdfData = this.pdfs.find(p => p.id === pdfId);
                if (!pdfData) continue;

                const arrayBuffer = await pdfData.file.arrayBuffer();
                const sourcePdf = await PDFDocument.load(arrayBuffer);
                const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageNum - 1]);
                mergedPdf.addPage(copiedPage);

                processed++;
                progressFill.style.width = `${(processed / totalPages) * 100}%`;
            }

            const pdfBytes = await mergedPdf.save();
            this.downloadPDF(pdfBytes, 'merged.pdf');

            progressFill.style.width = '100%';
            setTimeout(() => {
                progressBar.style.display = 'none';
                progressFill.style.width = '0%';
            }, 1000);

        } catch (error) {
            console.error('병합 중 오류 발생:', error);
            alert('PDF 병합 중 오류가 발생했습니다: ' + error.message);
            progressBar.style.display = 'none';
        }
    }

    downloadPDF(pdfBytes, filename) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearAll() {
        if (confirm('모든 PDF를 제거하시겠습니까?')) {
            this.pdfs = [];
            this.selectedPages = [];
            document.getElementById('pdfList').innerHTML = '';
            document.getElementById('fileInput').value = '';
            this.updateButtons();
        }
    }
}

// 앱 초기화
const pdfMerger = new PDFMerger();
