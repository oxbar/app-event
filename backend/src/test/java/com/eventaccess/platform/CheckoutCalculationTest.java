package com.eventaccess.platform;import org.junit.jupiter.api.*;import java.math.BigDecimal;import static org.assertj.core.api.Assertions.*;
class CheckoutCalculationTest {@Test void calculatesMoneyWithBigDecimal(){var total=new BigDecimal("50.00").add(new BigDecimal("5.00")).multiply(BigDecimal.valueOf(2));assertThat(total).isEqualByComparingTo("110.00");}}
