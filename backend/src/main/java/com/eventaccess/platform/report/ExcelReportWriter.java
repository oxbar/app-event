package com.eventaccess.platform.report;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * Escrita de planilhas com aparência de relatório, não de dump de banco.
 *
 * <p>Cabeçalho fixo, filtro automático, largura de coluna coerente com o
 * conteúdo, dinheiro em formato monetário e data como data de verdade — para
 * que ordenar por "pago em" no Excel funcione, em vez de ordenar texto.</p>
 */
public final class ExcelReportWriter implements AutoCloseable {
    private static final byte[] BRAND = {(byte) 0x2E, (byte) 0x24, (byte) 0x5C};
    private static final byte[] ZEBRA = {(byte) 0xF6, (byte) 0xF5, (byte) 0xFB};
    private static final String MONEY_FORMAT = "\"R$\"\\ #,##0.00";
    private static final String DATE_FORMAT = "dd/mm/yyyy hh:mm";
    private static final String INTEGER_FORMAT = "#,##0";
    private static final String PERCENT_FORMAT = "0.0%";

    private final XSSFWorkbook workbook = new XSSFWorkbook();
    private final ZoneId zone;

    private final CellStyle titleStyle;
    private final CellStyle subtitleStyle;
    private final CellStyle headerStyle;
    private final CellStyle labelStyle;
    private final CellStyle textStyle;
    private final CellStyle textZebraStyle;
    private final CellStyle moneyStyle;
    private final CellStyle moneyZebraStyle;
    private final CellStyle integerStyle;
    private final CellStyle integerZebraStyle;
    private final CellStyle dateStyle;
    private final CellStyle dateZebraStyle;
    private final CellStyle percentStyle;
    private final CellStyle totalTextStyle;
    private final CellStyle totalMoneyStyle;
    private final CellStyle totalIntegerStyle;

    public ExcelReportWriter(ZoneId zone) {
        this.zone = zone == null ? ZoneId.systemDefault() : zone;
        DataFormat formats = workbook.createDataFormat();

        Font titleFont = workbook.createFont();
        titleFont.setBold(true);
        titleFont.setFontHeightInPoints((short) 15);

        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setColor(IndexedColors.WHITE.getIndex());

        Font boldFont = workbook.createFont();
        boldFont.setBold(true);

        Font mutedFont = workbook.createFont();
        mutedFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());

        titleStyle = workbook.createCellStyle();
        titleStyle.setFont(titleFont);

        subtitleStyle = workbook.createCellStyle();
        subtitleStyle.setFont(mutedFont);

        headerStyle = workbook.createCellStyle();
        headerStyle.setFont(headerFont);
        headerStyle.setAlignment(HorizontalAlignment.LEFT);
        headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        ((XSSFCellStyle) headerStyle).setFillForegroundColor(new XSSFColor(BRAND, null));
        border(headerStyle);

        labelStyle = workbook.createCellStyle();
        labelStyle.setFont(boldFont);

        textStyle = base(null, false, formats);
        textZebraStyle = base(null, true, formats);
        moneyStyle = base(MONEY_FORMAT, false, formats);
        moneyZebraStyle = base(MONEY_FORMAT, true, formats);
        integerStyle = base(INTEGER_FORMAT, false, formats);
        integerZebraStyle = base(INTEGER_FORMAT, true, formats);
        dateStyle = base(DATE_FORMAT, false, formats);
        dateZebraStyle = base(DATE_FORMAT, true, formats);
        percentStyle = base(PERCENT_FORMAT, false, formats);

        totalTextStyle = total(null, formats, boldFont);
        totalMoneyStyle = total(MONEY_FORMAT, formats, boldFont);
        totalIntegerStyle = total(INTEGER_FORMAT, formats, boldFont);
    }

    public SheetWriter sheet(String name, String title, String subtitle) {
        Sheet sheet = workbook.createSheet(name);
        sheet.setDisplayGridlines(false);
        return new SheetWriter(sheet, title, subtitle);
    }

    public byte[] toByteArray() {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException error) {
            throw new UncheckedIOException("Falha ao gerar a planilha.", error);
        }
    }

    @Override
    public void close() {
        try {
            workbook.close();
        } catch (IOException error) {
            throw new UncheckedIOException("Falha ao fechar a planilha.", error);
        }
    }

    private CellStyle base(String format, boolean zebra, DataFormat formats) {
        CellStyle style = workbook.createCellStyle();
        if (format != null) style.setDataFormat(formats.getFormat(format));
        if (zebra) {
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            ((XSSFCellStyle) style).setFillForegroundColor(new XSSFColor(ZEBRA, null));
        }
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        border(style);
        return style;
    }

    private CellStyle total(String format, DataFormat formats, Font boldFont) {
        CellStyle style = workbook.createCellStyle();
        if (format != null) style.setDataFormat(formats.getFormat(format));
        style.setFont(boldFont);
        style.setBorderTop(BorderStyle.MEDIUM);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private static void border(CellStyle style) {
        style.setBorderTop(BorderStyle.HAIR);
        style.setBorderBottom(BorderStyle.HAIR);
        style.setBorderLeft(BorderStyle.HAIR);
        style.setBorderRight(BorderStyle.HAIR);
    }

    /** Escreve uma aba mantendo o controle da linha corrente. */
    public final class SheetWriter {
        private final Sheet sheet;
        private int rowIndex;
        private int headerRow = -1;
        private int columns;
        private boolean zebra;

        private SheetWriter(Sheet sheet, String title, String subtitle) {
            this.sheet = sheet;
            if (title != null && !title.isBlank()) {
                cell(sheet.createRow(rowIndex++), 0, title, titleStyle);
            }
            if (subtitle != null && !subtitle.isBlank()) {
                cell(sheet.createRow(rowIndex++), 0, subtitle, subtitleStyle);
            }
            if (rowIndex > 0) rowIndex++;
        }

        public SheetWriter headers(String... labels) {
            Row row = sheet.createRow(rowIndex);
            row.setHeightInPoints(22f);
            for (int column = 0; column < labels.length; column++) {
                cell(row, column, labels[column], headerStyle);
            }
            headerRow = rowIndex;
            columns = labels.length;
            rowIndex++;
            zebra = false;
            return this;
        }

        public SheetWriter widths(int... characters) {
            for (int column = 0; column < characters.length; column++) {
                sheet.setColumnWidth(column, Math.max(8, characters[column]) * 256);
            }
            return this;
        }

        /** Linha de dados: cada valor é tipado pelo wrapper {@link Value}. */
        public SheetWriter row(Value... values) {
            Row row = sheet.createRow(rowIndex++);
            for (int column = 0; column < values.length; column++) {
                Value value = values[column];
                if (value == null) {
                    // Uma coluna opcional nunca deve derrubar toda a exportação.
                    cell(row, column, "", zebra ? textZebraStyle : textStyle);
                } else {
                    value.write(row, column, zebra);
                }
            }
            zebra = !zebra;
            return this;
        }

        public SheetWriter keyValue(String label, String value) {
            Row row = sheet.createRow(rowIndex++);
            cell(row, 0, label, labelStyle);
            cell(row, 1, value, textStyle);
            return this;
        }

        public SheetWriter keyValue(String label, Number value) {
            Row row = sheet.createRow(rowIndex++);
            cell(row, 0, label, labelStyle);
            Cell cell = row.createCell(1);
            cell.setCellValue(value == null ? 0d : value.doubleValue());
            cell.setCellStyle(value instanceof BigDecimal ? moneyStyle : integerStyle);
            return this;
        }

        public SheetWriter keyValuePercent(String label, double ratio) {
            Row row = sheet.createRow(rowIndex++);
            cell(row, 0, label, labelStyle);
            Cell cell = row.createCell(1);
            cell.setCellValue(ratio);
            cell.setCellStyle(percentStyle);
            return this;
        }

        public SheetWriter blank() {
            rowIndex++;
            return this;
        }

        public SheetWriter heading(String text) {
            cell(sheet.createRow(rowIndex++), 0, text, titleStyle);
            return this;
        }

        /** Linha de totais destacada ao final de uma tabela. */
        public SheetWriter totals(Object... values) {
            Row row = sheet.createRow(rowIndex++);
            for (int column = 0; column < values.length; column++) {
                Object value = values[column];
                Cell cell = row.createCell(column);
                if (value instanceof BigDecimal money) {
                    cell.setCellValue(money.doubleValue());
                    cell.setCellStyle(totalMoneyStyle);
                } else if (value instanceof Number number) {
                    cell.setCellValue(number.doubleValue());
                    cell.setCellStyle(totalIntegerStyle);
                } else {
                    cell.setCellValue(value == null ? "" : value.toString());
                    cell.setCellStyle(totalTextStyle);
                }
            }
            return this;
        }

        /** Congela o cabeçalho e liga o filtro automático da faixa preenchida. */
        public SheetWriter finish() {
            if (headerRow >= 0 && columns > 0) {
                sheet.createFreezePane(0, headerRow + 1);
                int lastRow = Math.max(headerRow, rowIndex - 1);
                sheet.setAutoFilter(new CellRangeAddress(headerRow, lastRow, 0, columns - 1));
            }
            return this;
        }

        public int dataRows() {
            return headerRow < 0 ? 0 : Math.max(0, rowIndex - headerRow - 1);
        }
    }

    private static void cell(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    /** Valor tipado de célula: o tipo decide o formato aplicado. */
    public abstract class Value {
        abstract void write(Row row, int column, boolean zebra);
    }

    public Value text(String value) {
        return new Value() {
            @Override
            void write(Row row, int column, boolean zebra) {
                cell(row, column, value, zebra ? textZebraStyle : textStyle);
            }
        };
    }

    public Value money(BigDecimal value) {
        return new Value() {
            @Override
            void write(Row row, int column, boolean zebra) {
                Cell cell = row.createCell(column);
                cell.setCellValue(value == null ? 0d : value.doubleValue());
                cell.setCellStyle(zebra ? moneyZebraStyle : moneyStyle);
            }
        };
    }

    public Value integer(Number value) {
        return new Value() {
            @Override
            void write(Row row, int column, boolean zebra) {
                Cell cell = row.createCell(column);
                cell.setCellValue(value == null ? 0d : value.doubleValue());
                cell.setCellStyle(zebra ? integerZebraStyle : integerStyle);
            }
        };
    }

    public Value dateTime(OffsetDateTime value) {
        return new Value() {
            @Override
            void write(Row row, int column, boolean zebra) {
                Cell cell = row.createCell(column);
                CellStyle style = zebra ? dateZebraStyle : dateStyle;
                if (value == null) {
                    cell.setCellValue("");
                    cell.setCellStyle(zebra ? textZebraStyle : textStyle);
                    return;
                }
                LocalDateTime local = value.atZoneSameInstant(zone).toLocalDateTime();
                cell.setCellValue(local);
                cell.setCellStyle(style);
            }
        };
    }
}
