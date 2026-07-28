package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.Checkin;
import com.eventaccess.platform.domain.Order;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.List;

@Service
public class ReportWorkbookService {
    private static final String CURRENCY_FORMAT = "R$ #,##0.00";
    private static final String DATE_TIME_FORMAT = "dd/mm/yyyy hh:mm";

    public byte[] sales(String eventName, List<Order> orders) {
        return workbook("Vendas", eventName, book -> {
            Sheet sheet = book.createSheet("Vendas");
            Styles styles = new Styles(book);
            int rowIndex = createTitle(sheet, styles, "Relatório de vendas", eventName, 8);
            String[] headers = {"Pedido", "Status", "Comprador", "E-mail", "Subtotal", "Taxa", "Total", "Pago em"};
            createHeader(sheet, rowIndex++, headers, styles.header);

            int firstDataRow = rowIndex + 1;
            for (Order order : orders) {
                Row row = sheet.createRow(rowIndex++);
                text(row, 0, order.getPublicCode(), styles.body);
                text(row, 1, order.getStatus().name(), styles.status);
                text(row, 2, order.getBuyer().getName(), styles.body);
                text(row, 3, order.getBuyer().getEmail(), styles.body);
                money(row, 4, order.getSubtotal(), styles.currency);
                money(row, 5, order.getServiceFee(), styles.currency);
                money(row, 6, order.getTotalAmount(), styles.currencyStrong);
                date(row, 7, order.getPaidAt(), styles.dateTime);
            }

            Row total = sheet.createRow(rowIndex);
            Cell label = total.createCell(3);
            label.setCellValue("TOTAL");
            label.setCellStyle(styles.totalLabel);
            for (int column = 4; column <= 6; column++) {
                Cell cell = total.createCell(column);
                if (orders.isEmpty()) cell.setCellValue(0);
                else cell.setCellFormula("SUM(" + columnLetter(column) + firstDataRow + ":" + columnLetter(column) + rowIndex + ")");
                cell.setCellStyle(styles.totalCurrency);
            }

            configure(sheet, headers.length, 4, Math.max(4, rowIndex));
            int[] widths = {22, 18, 28, 34, 16, 16, 16, 21};
            applyWidths(sheet, widths);
        });
    }

    public byte[] checkins(String eventName, List<Checkin> checkins) {
        return workbook("Entradas", eventName, book -> {
            Sheet sheet = book.createSheet("Entradas");
            Styles styles = new Styles(book);
            int rowIndex = createTitle(sheet, styles, "Relatório de entradas", eventName, 7);
            String[] headers = {"Resultado", "Participante", "Ingresso", "Portaria", "Funcionário", "Horário", "Motivo"};
            createHeader(sheet, rowIndex++, headers, styles.header);

            for (Checkin checkin : checkins) {
                Row row = sheet.createRow(rowIndex++);
                text(row, 0, checkin.getResult().name(), styles.status);
                text(row, 1, checkin.getTicket() == null ? "" : checkin.getTicket().getAttendee().getName(), styles.body);
                text(row, 2, checkin.getTicket() == null ? "" : checkin.getTicket().getPublicCode(), styles.body);
                text(row, 3, checkin.getAccessPoint() == null ? "" : checkin.getAccessPoint().getName(), styles.body);
                text(row, 4, checkin.getStaffUser() == null ? "" : checkin.getStaffUser().getName(), styles.body);
                date(row, 5, checkin.getScannedAt(), styles.dateTime);
                text(row, 6, checkin.getReason(), styles.body);
            }

            configure(sheet, headers.length, 4, Math.max(4, rowIndex - 1));
            int[] widths = {18, 28, 24, 24, 26, 21, 42};
            applyWidths(sheet, widths);
        });
    }

    private byte[] workbook(String kind, String eventName, WorkbookWriter writer) {
        try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            book.getProperties().getCoreProperties().setTitle(kind + " — " + eventName);
            book.getProperties().getCoreProperties().setCreator("Event Access");
            writer.write(book);
            book.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Não foi possível gerar a planilha.", exception);
        }
    }

    private int createTitle(Sheet sheet, Styles styles, String title, String eventName, int columns) {
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(30);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(title);
        titleCell.setCellStyle(styles.title);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, columns - 1));

        Row eventRow = sheet.createRow(1);
        Cell eventCell = eventRow.createCell(0);
        eventCell.setCellValue("Evento: " + eventName);
        eventCell.setCellStyle(styles.subtitle);
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, columns - 1));

        Row generatedRow = sheet.createRow(2);
        Cell generatedCell = generatedRow.createCell(0);
        generatedCell.setCellValue("Gerado em: " + OffsetDateTime.now());
        generatedCell.setCellStyle(styles.metadata);
        sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, columns - 1));
        return 4;
    }

    private void createHeader(Sheet sheet, int rowIndex, String[] headers, CellStyle style) {
        Row row = sheet.createRow(rowIndex);
        row.setHeightInPoints(24);
        for (int column = 0; column < headers.length; column++) {
            Cell cell = row.createCell(column);
            cell.setCellValue(headers[column]);
            cell.setCellStyle(style);
        }
    }

    private void configure(Sheet sheet, int columns, int headerRow, int lastRow) {
        sheet.createFreezePane(0, headerRow + 1);
        sheet.setAutoFilter(new CellRangeAddress(headerRow, lastRow, 0, columns - 1));
        sheet.setDisplayGridlines(false);
        sheet.setZoom(90);
    }

    private void applyWidths(Sheet sheet, int[] widths) {
        for (int column = 0; column < widths.length; column++) {
            sheet.setColumnWidth(column, widths[column] * 256);
        }
    }

    private void text(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    private void money(Row row, int column, BigDecimal value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? 0 : value.doubleValue());
        cell.setCellStyle(style);
    }

    private void date(Row row, int column, OffsetDateTime value, CellStyle style) {
        Cell cell = row.createCell(column);
        if (value != null) cell.setCellValue(Date.from(value.toInstant()));
        cell.setCellStyle(style);
    }

    private String columnLetter(int zeroBasedColumn) {
        return String.valueOf((char) ('A' + zeroBasedColumn));
    }

    @FunctionalInterface
    private interface WorkbookWriter { void write(XSSFWorkbook workbook); }

    private static final class Styles {
        private final CellStyle title;
        private final CellStyle subtitle;
        private final CellStyle metadata;
        private final CellStyle header;
        private final CellStyle body;
        private final CellStyle status;
        private final CellStyle currency;
        private final CellStyle currencyStrong;
        private final CellStyle dateTime;
        private final CellStyle totalLabel;
        private final CellStyle totalCurrency;

        private Styles(XSSFWorkbook workbook) {
            DataFormat format = workbook.createDataFormat();

            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 18);
            titleFont.setColor(IndexedColors.WHITE.getIndex());
            title = workbook.createCellStyle();
            title.setFont(titleFont);
            title.setFillForegroundColor(IndexedColors.INDIGO.getIndex());
            title.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            title.setVerticalAlignment(VerticalAlignment.CENTER);

            Font subtitleFont = workbook.createFont();
            subtitleFont.setBold(true);
            subtitleFont.setFontHeightInPoints((short) 11);
            subtitle = workbook.createCellStyle();
            subtitle.setFont(subtitleFont);
            subtitle.setFillForegroundColor(IndexedColors.LAVENDER.getIndex());
            subtitle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            metadata = workbook.createCellStyle();
            Font metadataFont = workbook.createFont();
            metadataFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            metadataFont.setItalic(true);
            metadata.setFont(metadataFont);

            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            header = bordered(workbook);
            header.setFont(headerFont);
            header.setFillForegroundColor(IndexedColors.INDIGO.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.LEFT);

            body = bordered(workbook);
            body.setVerticalAlignment(VerticalAlignment.TOP);
            body.setWrapText(true);

            status = bordered(workbook);
            Font statusFont = workbook.createFont();
            statusFont.setBold(true);
            status.setFont(statusFont);

            currency = bordered(workbook);
            currency.setDataFormat(format.getFormat(CURRENCY_FORMAT));

            currencyStrong = bordered(workbook);
            currencyStrong.setDataFormat(format.getFormat(CURRENCY_FORMAT));
            Font strongFont = workbook.createFont();
            strongFont.setBold(true);
            currencyStrong.setFont(strongFont);

            dateTime = bordered(workbook);
            dateTime.setDataFormat(format.getFormat(DATE_TIME_FORMAT));

            totalLabel = bordered(workbook);
            totalLabel.setFont(strongFont);
            totalLabel.setAlignment(HorizontalAlignment.RIGHT);
            totalLabel.setFillForegroundColor(IndexedColors.LAVENDER.getIndex());
            totalLabel.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            totalCurrency = bordered(workbook);
            totalCurrency.setFont(strongFont);
            totalCurrency.setDataFormat(format.getFormat(CURRENCY_FORMAT));
            totalCurrency.setFillForegroundColor(IndexedColors.LAVENDER.getIndex());
            totalCurrency.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }

        private static CellStyle bordered(Workbook workbook) {
            CellStyle style = workbook.createCellStyle();
            style.setBorderBottom(BorderStyle.THIN);
            style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
            style.setVerticalAlignment(VerticalAlignment.CENTER);
            return style;
        }
    }
}
