/*
 * catalogo-dados.js
 * ------------------------------------------------------------
 * Biblioteca compartilhada entre catalogo.html e as calculadoras
 * (som.html, luz.html, video.html).
 *
 * Guarda os equipamentos "customizados" (cadastrados pelo usuário
 * em catalogo.html) no localStorage do navegador e oferece funções
 * de "merge" que cada calculadora chama, uma vez, na inicialização,
 * para juntar esses itens customizados aos catálogos padrão (CAIXAS,
 * CONSOLES, EXPANSOES, EQUIPAMENTOS, PESO_PAINEL_POR_PITCH,
 * PERFIL_ELETRICO, PROCESSADORAS_NOVASTAR) já existentes em cada
 * página, sem precisar reescrever essas listas.
 *
 * Importante: os dados ficam salvos no localStorage do navegador,
 * ou seja, só neste computador/navegador. Use o botão "Exportar
 * backup" do catálogo para guardar uma cópia .json e poder importar
 * em outro computador ou navegador.
 * ------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'mm_catalogo_custom_v1';

  function vazio() {
    return {
      caixas: {},        // caixas de som
      mesasSom: {},       // mesas de som
      stagesSom: {},       // racks/stageboxes de expansão de som
      aparelhosLuz: {},   // aparelhos de iluminação
      mesasLuz: {},        // mesas de luz
      pitchesLed: {},     // pixel pitches de painel de LED
      processadoras: {}   // processadoras de vídeo
    };
  }

  function carregar() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return vazio();
      var d = JSON.parse(raw);
      var base = vazio();
      Object.keys(base).forEach(function (k) {
        if (d && d[k] && typeof d[k] === 'object') base[k] = d[k];
      });
      return base;
    } catch (e) {
      return vazio();
    }
  }

  function salvar(dados) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
      return true;
    } catch (e) {
      return false;
    }
  }

  function slugify(txt, prefixo) {
    var base = String(txt || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    if (!base) base = 'item';
    return (prefixo || 'c_') + base;
  }

  // garante uma chave única (evita colisão com o que já existe no objeto "existentes")
  function chaveUnica(txt, prefixo, existentes) {
    var base = slugify(txt, prefixo);
    var chave = base;
    var i = 2;
    while (existentes && Object.prototype.hasOwnProperty.call(existentes, chave)) {
      chave = base + '_' + i;
      i++;
    }
    return chave;
  }

  // ================== merges usados pelas calculadoras ==================

  function mergeCaixas(CAIXAS) {
    var d = carregar();
    Object.keys(d.caixas).forEach(function (k) { CAIXAS[k] = d.caixas[k]; });
  }

  function mergeExpansoes(EXPANSOES) {
    var d = carregar();
    Object.keys(d.stagesSom).forEach(function (k) { EXPANSOES[k] = d.stagesSom[k]; });
  }

  function mergeConsolesSom(CONSOLES, BRANDS) {
    var d = carregar();
    var keys = Object.keys(d.mesasSom);
    if (!keys.length) return;
    var porMarca = {};
    keys.forEach(function (k) {
      CONSOLES[k] = d.mesasSom[k];
      var marca = d.mesasSom[k].marca || 'Mesas personalizadas';
      (porMarca[marca] = porMarca[marca] || []).push(k);
    });
    Object.keys(porMarca).forEach(function (marca) {
      var grupo = BRANDS.filter(function (b) { return b.title === marca; })[0];
      if (!grupo) {
        grupo = { title: marca, keys: [] };
        BRANDS.push(grupo);
      }
      porMarca[marca].forEach(function (k) {
        if (grupo.keys.indexOf(k) === -1) grupo.keys.push(k);
      });
    });
  }

  function mergeEquipamentosLuz(EQUIPAMENTOS) {
    var d = carregar();
    Object.keys(d.aparelhosLuz).forEach(function (k) { EQUIPAMENTOS[k] = d.aparelhosLuz[k]; });
  }

  function mergeConsolesLuz(CONSOLES) {
    var d = carregar();
    Object.keys(d.mesasLuz).forEach(function (k) { CONSOLES[k] = d.mesasLuz[k]; });
  }

  function mergePainelLed(PESO_PAINEL_POR_PITCH, PERFIL_ELETRICO, selectEl) {
    var d = carregar();
    var keys = Object.keys(d.pitchesLed);
    if (!keys.length) return;
    keys.sort(function (a, b) { return parseFloat(a) - parseFloat(b); });
    keys.forEach(function (k) {
      var p = d.pitchesLed[k];
      PESO_PAINEL_POR_PITCH[k] = { '100': p.peso100, '50': p.peso50 };
      if (PERFIL_ELETRICO && PERFIL_ELETRICO.indoor) PERFIL_ELETRICO.indoor.maxWm2[k] = p.maxWm2Indoor;
      if (PERFIL_ELETRICO && PERFIL_ELETRICO.outdoor) PERFIL_ELETRICO.outdoor.maxWm2[k] = p.maxWm2Outdoor;
      if (selectEl && !selectEl.querySelector('option[value="' + k + '"]')) {
        var opt = document.createElement('option');
        opt.value = k;
        opt.textContent = p.label || ('P' + k);
        selectEl.appendChild(opt);
      }
    });
  }

  function mergeProcessadoras(PROCESSADORAS_ARR) {
    var d = carregar();
    Object.keys(d.processadoras).forEach(function (k) {
      PROCESSADORAS_ARR.push(d.processadoras[k]);
    });
  }

  global.MMCatalogo = {
    STORAGE_KEY: STORAGE_KEY,
    vazio: vazio,
    carregar: carregar,
    salvar: salvar,
    slugify: slugify,
    chaveUnica: chaveUnica,
    mergeCaixas: mergeCaixas,
    mergeExpansoes: mergeExpansoes,
    mergeConsolesSom: mergeConsolesSom,
    mergeEquipamentosLuz: mergeEquipamentosLuz,
    mergeConsolesLuz: mergeConsolesLuz,
    mergePainelLed: mergePainelLed,
    mergeProcessadoras: mergeProcessadoras
  };
})(window);
