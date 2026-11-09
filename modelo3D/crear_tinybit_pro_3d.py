"""Modelo conceptual editable Yahboom Tiny:bit Pro basado en imágenes de referencia.
Ejecutar: pip install trimesh numpy && python crear_tinybit_pro_3d.py
Produce Tinybit_Pro_conceptual.glb y Tinybit_Pro_conceptual.obj.
No es CAD dimensional ni modelo oficial de fabricación.
"""
import numpy as np
import trimesh
from pathlib import Path
from trimesh.transformations import rotation_matrix

OUT=Path(__file__).parent
scene=trimesh.Scene()
C={
 'chassis':(19,29,46,255),'edge':(91,144,180,255),'black':(16,19,25,255),
 'tire':(23,24,30,255),'tread':(39,42,49,255),'silver':(180,193,205,255),
 'metal':(115,134,150,255),'blue':(22,88,207,255),'pcb':(24,27,35,255),
 'red':(245,47,48,255),'gold':(199,151,66,255),'glass':(66,102,132,220),
 'white':(235,236,232,255),'lens':(14,23,41,255),'cyan':(40,200,223,255),
 'brown':(145,87,52,255),
}
def put(m,name,col,pos=(0,0,0),rot=None):
 m.visual.vertex_colors=np.tile(np.array(C[col],dtype=np.uint8),(len(m.vertices),1))
 if rot is not None: m.apply_transform(rot)
 m.apply_translation(pos)
 scene.add_geometry(m,geom_name=name)

def box(name, ext, pos, col):put(trimesh.creation.box(extents=ext),name,col,pos)
def cyl(name,r,h,pos,col,axis='z',sections=32):
 m=trimesh.creation.cylinder(radius=r,height=h,sections=sections)
 if axis=='x':m.apply_transform(rotation_matrix(np.pi/2,[0,1,0]))
 if axis=='y':m.apply_transform(rotation_matrix(np.pi/2,[1,0,0]))
 put(m,name,col,pos)
def tube(name,outer,inner,h,pos,col,axis='z',sections=48):
 # Annular mesh, genuinely hollow ring
 a=np.linspace(0,2*np.pi,sections,endpoint=False)
 verts=[]
 for z in [-h/2,h/2]:
  for r in [outer,inner]:
   verts.extend([(r*np.cos(t),r*np.sin(t),z) for t in a])
 faces=[]
 for k in range(sections):
  j=(k+1)%sections
  ob=k; on=j; ib=sections+k; inn=sections+j
  ot=2*sections+k; otn=2*sections+j; it=3*sections+k; itn=3*sections+j
  faces.extend([(ob,on,otn),(ob,otn,ot),(inn,ib,it),(inn,it,itn), (ot,otn,itn),(ot,itn,it),(on,ob,ib),(on,ib,inn)])
 m=trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=True)
 if axis=='x':m.apply_transform(rotation_matrix(np.pi/2,[0,1,0]))
 if axis=='y':m.apply_transform(rotation_matrix(np.pi/2,[1,0,0]))
 put(m,name,col,pos)

# Base orientada al frente (-Y), dimensiones aproximadas en unidades arbitrarias.
cyl('01_Chasis_circular_PCB',1.15,.12,(0,0,.32),'chassis',sections=72)
cyl('02_Placa_circular_superior',1.08,.045,(0,0,.395),'pcb',sections=72)
# Acentos azules en la cubierta
for side in (-1,1):
 box(f'03_Banda_azul_{side}',(.42,.71,.025),(.52*side,-.15,.43),'blue')
# Motores y ruedas grandes con llantas visibles
for side in (-1,1):
 x=side*1.20
 cyl(f'10_Rueda_caucho_{side}',.53,.34,(x,.20,.46),'tire',axis='x',sections=64)
 cyl(f'11_Rin_blanco_{side}',.345,.352,(x,.20,.46),'white',axis='x',sections=64)
 cyl(f'12_Centro_eje_{side}',.075,.38,(x,.20,.46),'metal',axis='x')
 # huella de rodamiento, 28 bloques separados alrededor del perímetro
 for i,theta in enumerate(np.linspace(0,2*np.pi,28,endpoint=False)):
  yy=.20+.53*np.sin(theta);zz=.46+.53*np.cos(theta)
  m=trimesh.creation.box(extents=(.32,.115,.065))
  # orientación de la huella tangencial al cilindro
  m.apply_transform(rotation_matrix(-theta,[1,0,0]))
  put(m,f'13_Taco_neumatico_{side}_{i:02}', 'tread',(x,yy,zz))
 box(f'14_Motor_{side}',(.42,.50,.30),(side*.76,.2,.42),'metal')
# Pivote delantero inferior
cyl('20_Rueda_loca_frontal',.15,.21,(0,-.94,.17),'white')
box('21_Brazo_rueda_loca',(.14,.25,.13),(0,-.91,.27),'metal')
# LEDs frontales
for side in (-1,1):
 cyl(f'22_LED_frontal_{side}',.145,.17,(side*.85,-.89,.50),'glass',axis='y')
 cyl(f'23_Lente_LED_{side}',.067,.179,(side*.85,-.985,.50),'cyan',axis='y')
# Módulo sensor ultrasónico frontal - doble transductor
box('30_Placa_ultrasonico_azul',(1.22,.085,.56),(0,-1.01,.69),'blue')
for side in (-1,1):
 cyl(f'31_Sensor_cilindro_{side}',.265,.31,(side*.35,-1.20,.71),'silver',axis='y',sections=64)
 cyl(f'32_Sensor_interior_{side}',.208,.318,(side*.35,-1.205,.71),'black',axis='y',sections=64)
 tube(f'33_Aro_sensor_{side}',.259,.207,.035,(side*.35,-1.369,.71),'metal',axis='y')
 for sx in [-.51,.51]:
  pass
# Cuerpo central
box('40_Modulo_electronica',(1.26,1.14,.38),(0,-.12,.68),'black')
box('41_Placa_microbit',(1.18,.87,.12),(0,-.19,.95),'pcb')
# Matriz LED 5x5 roja
for r in range(5):
 for c in range(5):
  box(f'42_LED_microbit_{r}_{c}',(.045,.048,.014),((c-2)*.117,-.36+(r-2)*.117,1.02),'red')
for side in (-1,1):
 cyl(f'43_Boton_microbit_{side}',.075,.046,(side*.45,-.17,1.037),'black')
# Bastidores verticales hasta cámara
for side in (-1,1):
 box(f'50_Soporte_vertical_{side}',(.125,.15,1.67),(side*.60,.19,1.77),'black')
 box(f'51_Pie_soporte_{side}',(.23,.25,.17),(side*.60,.19,.89),'metal')
# Cámara / AI box en parte superior
box('60_Carcasa_posterior_camara',(1.83,.21,1.12),(0,.21,2.70),'white')
box('61_Placa_frontal_camara',(1.76,.07,1.01),(0,.078,2.70),'metal')
box('62_Tapa_optica_oscura',(1.68,.021,.92),(0,.025,2.70),'glass')
# Lente mirando hacia delante (-y)
cyl('63_Bisel_lente_camara',.135,.12,(0,-.06,2.75),'black',axis='y')
cyl('64_Cristal_lente_camara',.085,.127,(0,-.11,2.75),'lens',axis='y')
cyl('65_Destello_lente',.028,.131,(.022,-.112,2.77),'cyan',axis='y')
box('66_Cable_flex_camara',(.13,.025,.53),(0,-.08,2.43),'brown')
for sx in (-1,1):
 for sz in (-1,1):
  cyl(f'67_Tornillo_{sx}_{sz}',.05,.082,(sx*.79,-.015,2.70+sz*.43),'silver',axis='y')
# detalles placa y tornillos base
for i,t in enumerate(np.linspace(0,2*np.pi,8,endpoint=False)):
 cyl(f'70_Tornillo_base_{i}',.033,.028,(.95*np.cos(t),.95*np.sin(t),.438),'gold')
# Exports
for ext in ['glb','obj']:
 p=OUT / f'Tinybit_Pro_conceptual.{ext}'
 p.write_bytes(scene.export(file_type=ext) if ext=='glb' else scene.export(file_type=ext).encode('utf-8'))
 print(p, p.stat().st_size)
