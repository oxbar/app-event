package com.eventaccess.platform.web;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.time.OffsetDateTime;
import java.util.*;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    record FieldErrorDto(String field, String message) {}
    record ApiError(OffsetDateTime timestamp, int status, String code, String message, List<FieldErrorDto> fieldErrors, String traceId) {}

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException ex) {
        return ResponseEntity.status(ex.getStatus()).body(new ApiError(OffsetDateTime.now(), ex.getStatus().value(), ex.getCode(), ex.getMessage(), List.of(), MDC.get("traceId")));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex) {
        var fields=ex.getBindingResult().getFieldErrors().stream().map(e->new FieldErrorDto(e.getField(), Optional.ofNullable(e.getDefaultMessage()).orElse("Valor inválido."))).toList();
        return ResponseEntity.badRequest().body(new ApiError(OffsetDateTime.now(),400,"VALIDATION_ERROR","Existem dados inválidos.",fields,MDC.get("traceId")));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> accessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError(
                OffsetDateTime.now(),
                HttpStatus.FORBIDDEN.value(),
                "ACCESS_DENIED",
                "Você não possui permissão para esta ação.",
                List.of(),
                MDC.get("traceId")));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception ex) {
        log.error("Erro inesperado. traceId={}", MDC.get("traceId"), ex);
        return ResponseEntity.status(500).body(new ApiError(OffsetDateTime.now(),500,"UNEXPECTED_ERROR","Ocorreu um erro inesperado.",List.of(),MDC.get("traceId")));
    }
}
