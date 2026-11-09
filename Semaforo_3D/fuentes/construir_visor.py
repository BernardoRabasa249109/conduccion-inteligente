from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'visor_template.html').read_text(encoding='utf8')
html=html.replace('__THREE__',(root/'three.min.js').read_text(encoding='utf8'))
html=html.replace('__MESH_DATA__',(root/'mallas.json').read_text(encoding='utf8'))
(root.parent/'Semaforo_3D.html').write_text(html,encoding='utf8')
print('Semaforo_3D.html actualizado.')
