/* Optional UDT development-plugin bootstrap; menu launch remains unverified. */
require('uxp').entrypoints.setup({commands:{inspectBook(){
  console.log(JSON.stringify(globalThis.bookUXP.inspect(),null,2));
}}});
