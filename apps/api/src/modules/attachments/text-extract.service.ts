import { BadRequestException, Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import type { AttachmentKind } from './attachment-types';

const XLSX_MAX_ROWS = 50;
const TRUNCATION_SUFFIX = '\n...(truncated)';

@Injectable()
export class TextExtractService {
  async extractText(
    kind: AttachmentKind,
    buffer: Buffer,
    filename: string,
  ): Promise<string> {
    if (kind === 'text') {
      return buffer.toString('utf8');
    }

    if (kind === 'office') {
      const ext = path.extname(filename).toLowerCase();
      switch (ext) {
        case '.pdf':
          return this.extractPdf(buffer);
        case '.docx':
          return this.extractDocx(buffer);
        case '.xlsx':
          return this.extractXlsx(buffer);
        default:
          throw new BadRequestException(`不支持的办公文件类型: ${ext || filename}`);
      }
    }

    throw new BadRequestException('该附件类型不支持文本抽取');
  }

  truncateExtracted(text: string, maxBytes = 102_400): string {
    const encoded = Buffer.from(text, 'utf8');
    if (encoded.length <= maxBytes) {
      return text;
    }

    const suffix = Buffer.from(TRUNCATION_SUFFIX, 'utf8');
    const budget = Math.max(0, maxBytes - suffix.length);
    let end = budget;
    while (end > 0 && (encoded[end] & 0xc0) === 0x80) {
      end--;
    }

    return Buffer.concat([encoded.subarray(0, end), suffix]).toString('utf8');
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  private extractXlsx(buffer: Buffer): string {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return '';
    }

    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    return csv
      .split(/\r?\n/)
      .slice(0, XLSX_MAX_ROWS)
      .join('\n')
      .trim();
  }
}
