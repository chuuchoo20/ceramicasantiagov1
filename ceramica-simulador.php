<?php
/**
 * Plugin Name: Simulador Cerámica Santiago (prototipo)
 * Description: Inserta el estudio mediante [ceramica_simulador]. Instalar la carpeta completa, incluyendo index.html, ra, src y assets.
 * Version: 0.2.0
 */
if (!defined('ABSPATH')) { exit; }
add_shortcode('ceramica_simulador', function () {
    $url = plugins_url('index.html', __FILE__);
    return '<iframe src="' . esc_url($url) . '" title="Simulador de Cerámica Santiago" loading="lazy" allow="camera; accelerometer; gyroscope; magnetometer; xr-spatial-tracking; fullscreen" allowfullscreen style="display:block;width:100%;height:1100px;border:0;border-radius:12px"></iframe>';
});
