import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="legal-page">
      <header class="legal-header">
        <a routerLink="/" class="payment-brand"><span>EA</span><b>Event Access</b></a>
        <a routerLink="/" class="text-link">Voltar</a>
      </header>

      <article class="legal-document">
        @if (kind === 'terms') {
          <span class="eyebrow">DOCUMENTO LEGAL</span>
          <h1>Termos de Uso</h1>
          <p class="legal-updated">Última atualização: 27 de julho de 2026.</p>

          <h2>1. Sobre a plataforma</h2>
          <p>O Event Access oferece recursos para divulgação de eventos, venda de ingressos, pagamento por Pix, emissão de ingressos digitais e controle de acesso. O organizador do evento é responsável pelas informações, programação, local, capacidade, regras específicas e execução do evento.</p>

          <h2>2. Cadastro e informações do comprador</h2>
          <p>O comprador deve fornecer informações verdadeiras, completas e atualizadas. O ingresso pode ser nominal e, quando solicitado pelo organizador, exigir documento de identificação válido na entrada.</p>

          <h2>3. Compra e pagamento</h2>
          <p>Antes de concluir a compra, são apresentados preço, taxa de serviço, quantidade e valor total. A emissão do ingresso ocorre somente após a confirmação do pagamento. Pagamentos Pix podem ser processados por um parceiro financeiro indicado na tela de pagamento.</p>

          <h2>4. Ingresso digital e QR Code</h2>
          <p>Cada ingresso é individual e possui código e QR Code próprios. O comprador é responsável por protegê-los contra cópia ou compartilhamento indevido. O primeiro uso válido registra a entrada; tentativas posteriores podem ser recusadas.</p>

          <h2>5. Entrada no evento</h2>
          <p>A entrada depende da validade do ingresso, confirmação do pagamento, período do evento e regras definidas pelo organizador. Ingressos bloqueados, cancelados, reembolsados, expirados ou já utilizados serão recusados.</p>

          <h2>6. Cancelamento e reembolso</h2>
          <p>Pedidos de cancelamento e reembolso estão sujeitos à legislação aplicável, às regras divulgadas pelo organizador e ao status do ingresso. Ingressos já utilizados não podem ser reembolsados pela plataforma.</p>

          <h2>7. Condutas proibidas</h2>
          <p>É proibido fraudar pagamentos, falsificar ingressos, tentar burlar o controle de acesso, utilizar dados de terceiros sem autorização, explorar falhas de segurança ou praticar qualquer ato ilícito.</p>

          <h2>8. Disponibilidade e segurança</h2>
          <p>São adotadas medidas razoáveis para disponibilidade e segurança, mas podem ocorrer interrupções por manutenção, falhas de terceiros, conectividade ou eventos fora do controle da plataforma. Incidentes devem ser comunicados ao organizador ou ao canal de suporte divulgado.</p>

          <h2>9. Alterações</h2>
          <p>Estes termos podem ser atualizados para refletir mudanças legais, técnicas ou operacionais. A versão vigente será disponibilizada nesta página.</p>

          <h2>10. Contato</h2>
          <p>Dúvidas sobre a compra ou o evento devem ser encaminhadas ao organizador. Questões técnicas ou de privacidade podem ser enviadas ao canal de suporte informado pela organização responsável.</p>
        } @else {
          <span class="eyebrow">PROTEÇÃO DE DADOS</span>
          <h1>Política de Privacidade</h1>
          <p class="legal-updated">Última atualização: 27 de julho de 2026.</p>

          <h2>1. Quem trata os dados</h2>
          <p>O organizador do evento e a plataforma Event Access tratam dados conforme suas respectivas responsabilidades. Parceiros de pagamento, como o provedor Pix exibido no checkout, também podem tratar dados de acordo com suas próprias políticas.</p>

          <h2>2. Dados coletados</h2>
          <p>Podem ser coletados nome, e-mail, telefone, documento, dados do pedido, pagamento, ingresso, registros de acesso, endereço IP, identificador do dispositivo e informações necessárias para segurança, suporte e auditoria.</p>

          <h2>3. Finalidades</h2>
          <p>Os dados são utilizados para processar compras, confirmar pagamentos, emitir ingressos, validar entradas, prevenir fraudes, prestar suporte, produzir relatórios operacionais, cumprir obrigações legais e proteger os direitos dos participantes e organizadores.</p>

          <h2>4. Documento e QR Code</h2>
          <p>Quando exigido, o documento é protegido e utilizado para identificação e prevenção de duplicidade. O QR Code do ingresso contém um token opaco e não inclui nome, CPF, e-mail, telefone ou preço.</p>

          <h2>5. Compartilhamento</h2>
          <p>Os dados podem ser compartilhados com o organizador, equipe autorizada de portaria, processador de pagamento, provedores de infraestrutura, serviços de comunicação e autoridades quando houver obrigação legal ou necessidade de proteção contra fraude.</p>

          <h2>6. Armazenamento e segurança</h2>
          <p>São adotados controles de acesso, registros de auditoria, criptografia ou hash para dados sensíveis e isolamento por organização. Nenhum sistema é totalmente imune a riscos, mas medidas técnicas e administrativas são aplicadas para reduzi-los.</p>

          <h2>7. Retenção</h2>
          <p>Os dados são mantidos pelo período necessário para executar o contrato, atender obrigações legais, resolver disputas, prevenir fraudes e manter registros de auditoria. Após esse período, podem ser eliminados ou anonimizados.</p>

          <h2>8. Direitos do titular</h2>
          <p>O titular pode solicitar confirmação de tratamento, acesso, correção, informação sobre compartilhamento, anonimização, bloqueio, eliminação quando aplicável, portabilidade e revisão de decisões automatizadas, observadas as limitações legais.</p>

          <h2>9. Menores de idade</h2>
          <p>Compras ou participação de menores devem observar as regras do evento e, quando necessário, a autorização ou acompanhamento do responsável legal.</p>

          <h2>10. Cookies e armazenamento local</h2>
          <p>A aplicação pode utilizar armazenamento local para sessão, preferência de tema e funcionamento técnico. Esses recursos não devem ser usados para armazenar informações de pagamento sensíveis.</p>

          <h2>11. Atualizações e contato</h2>
          <p>Esta política pode ser atualizada. Solicitações relacionadas a dados pessoais devem ser encaminhadas ao organizador ou ao canal de privacidade informado pela organização responsável.</p>
        }

        <aside class="legal-notice">
          Este conteúdo é um modelo operacional inicial e deve ser revisado por assessoria jurídica antes do uso em produção.
        </aside>
      </article>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalPageComponent {
  readonly kind = inject(ActivatedRoute).snapshot.data['kind'] as 'terms' | 'privacy';
}
