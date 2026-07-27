param(
    [Parameter(Mandatory = $true)]
    [string]$OrderCode
)

$ErrorActionPreference = "Stop"
$baseUrl = "https://api-sandbox.asaas.com/v3"
$envFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envFile)) {
    throw "Arquivo .env não encontrado em $PSScriptRoot"
}

$apiKeyLine = Get-Content $envFile |
    Where-Object { $_ -match '^ASAAS_API_KEY=' } |
    Select-Object -First 1

if (-not $apiKeyLine) {
    throw "ASAAS_API_KEY não encontrada no arquivo .env"
}

$apiKey = ($apiKeyLine -split '=', 2)[1].Trim().Trim("'").Trim('"')

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "ASAAS_API_KEY está vazia"
}

$headers = @{
    "access_token" = $apiKey
    "User-Agent"   = "event-access-platform/1.0"
    "Accept"       = "application/json"
}

try {
    $encodedOrderCode = [System.Uri]::EscapeDataString($OrderCode)

    Write-Host "Procurando cobrança do pedido $OrderCode..."

    $consulta = Invoke-RestMethod `
        -Method Get `
        -Uri "$baseUrl/payments?externalReference=$encodedOrderCode&limit=1" `
        -Headers $headers

    $cobranca = $consulta.data | Select-Object -First 1

    if (-not $cobranca) {
        throw "Cobrança não encontrada no Asaas para o pedido $OrderCode"
    }

    Write-Host ""
    Write-Host "Cobrança encontrada:"
    $cobranca |
        Select-Object id, status, value, externalReference |
        Format-List

    if ($cobranca.status -in @("RECEIVED", "CONFIRMED")) {
        Write-Host "Essa cobrança já está aprovada: $($cobranca.status)"
        exit 0
    }

    Write-Host "Confirmando pagamento no Asaas Sandbox..."

    Invoke-RestMethod `
        -Method Post `
        -Uri "$baseUrl/sandbox/payment/$($cobranca.id)/confirm" `
        -Headers $headers `
        -ContentType "application/json" `
        -Body "{}" |
        Out-Null

    Start-Sleep -Seconds 2

    $statusResponse = Invoke-RestMethod `
        -Method Get `
        -Uri "$baseUrl/payments/$($cobranca.id)/status" `
        -Headers $headers

    Write-Host ""
    Write-Host "Novo status no Asaas: $($statusResponse.status)"

    if ($statusResponse.status -in @("RECEIVED", "CONFIRMED")) {
        Write-Host "Pagamento aprovado com sucesso no Sandbox."
    }
    else {
        throw "Status inesperado após confirmação: $($statusResponse.status)"
    }
}
finally {
    Remove-Variable apiKey -ErrorAction SilentlyContinue
}