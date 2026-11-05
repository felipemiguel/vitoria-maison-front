# Arquitetura

O App Router organiza as páginas e usa Server Components para leitura de dados. Componentes client-side ficam restritos a busca, filtros, galeria, menu e formulários.

O domínio imobiliário vive em `features/properties`. A interface `PropertyRepository` isola a aplicação da fonte de dados. A implementação atual é `MockPropertyRepository`; páginas e componentes nunca importam os mocks diretamente.

Dados comerciais, localização, curadoria e conteúdo editorial são grupos distintos no modelo `Property`, permitindo preservar conteúdo Maison durante uma futura sincronização com o CRM.
