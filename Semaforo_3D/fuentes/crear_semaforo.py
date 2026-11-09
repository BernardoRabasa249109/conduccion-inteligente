import bpy, math, json, os
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=0.001

def mat(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
body=mat('Carcasa_grafito',(.055,.062,.068),.25,.34)
base=mat('Base_grafito',(.075,.081,.086),.15,.46)
silver=mat('Poste_aluminio',(.48,.51,.54),.8,.3)
black=mat('Juntas_negras',(.014,.018,.02),.05,.55)
red=mat('Lente_roja_apagada',(.21,.008,.012),.1,.24)
amber=mat('Lente_ambar_apagada',(.24,.105,.006),.1,.24)
green=mat('Lente_verde_apagada',(.006,.13,.037),.1,.24)
parts=[]
def finish(o,name,m,bevel=0,smooth=True):
 o.name=name;o.data.materials.append(m);parts.append(o)
 if bevel:
  mod=o.modifiers.new('Bordes_redondeados','BEVEL');mod.width=bevel;mod.segments=5
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 if smooth:
  for p in o.data.polygons:p.use_smooth=True
  mod=o.modifiers.new('Normales','WEIGHTED_NORMAL');mod.keep_sharp=True
  bpy.context.view_layer.objects.active=o
  try:bpy.ops.object.modifier_apply(modifier=mod.name)
  except:pass
 return o
def cube(name,loc,size,m,b=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,b)
def cyl(name,loc,r,depth,m,b=0,rot=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=80,radius=r,depth=depth,location=loc);o=bpy.context.object
 if rot:o.rotation_euler=rot
 return finish(o,name,m,b)
def torus(name,loc,major,minor,m):
 bpy.ops.mesh.primitive_torus_add(major_segments=80,minor_segments=12,location=loc,major_radius=major,minor_radius=minor,rotation=(math.pi/2,0,0));return finish(bpy.context.object,name,m)

cyl('Base_circular',(0,0,9),52,18,base,2.5)
cyl('Collarin_inferior',(0,0,22),11,10,body,1.6)
cyl('Poste',(0,0,94),7,146,silver,.7)
cyl('Collarin_superior',(0,0,165),9,10,body,1)
cube('Carcasa_principal',(0,0,232),(57,37,136),body,7)
cube('Marco_frontal',(0,-18.3,232),(51,5,129),black,5)
cube('Placa_trasera',(0,18.6,232),(45,2.5,117),body,3)
for x in [-18,18]:
 for z in [181,283]:
  cyl('Tornillo_trasero_'+str(x)+'_'+str(z),(x,20.4,z),1.5,1.2,silver,.2,(math.pi/2,0,0))

def hood(name,zc):
 # Closed thick upper semicylindrical shell; front projection deepest at crown.
 N=64; verts=[]
 for radius in [22.8,20.8]:
  for front in [False,True]:
   for i in range(N+1):
    t=-.12+(math.pi+.24)*i/N
    y=-20.5-(19+8*max(0,math.sin(t)) if front else 0)
    verts.append((radius*math.cos(t),y,zc+radius*math.sin(t)))
 def ix(r,f,i):return (r*2+f)*(N+1)+i
 faces=[]
 for i in range(N):
  faces.extend([(ix(0,0,i),ix(0,0,i+1),ix(0,1,i+1),ix(0,1,i)),(ix(1,0,i),ix(1,1,i),ix(1,1,i+1),ix(1,0,i+1)),(ix(0,0,i),ix(1,0,i),ix(1,0,i+1),ix(0,0,i+1)),(ix(0,1,i),ix(0,1,i+1),ix(1,1,i+1),ix(1,1,i))])
 for i in [0,N]:faces.append((ix(0,0,i),ix(0,1,i),ix(1,1,i),ix(1,0,i)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 return finish(o,name,body,.35)

for name,z,m in [('roja',277,red),('ambar',233,amber),('verde',189,green)]:
 cyl('Aro_'+name,(0,-21,z),21.2,3.4,body,.6,(math.pi/2,0,0))
 torus('Junta_'+name,(0,-23,z),19.1,.8,black)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=24,location=(0,-23,z))
 o=bpy.context.object;o.scale=(18.7,2.7,18.7);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'Lente_'+name,m)
 # Subtle optical cells, all unlit and the same material as their lens.
 for row in range(-5,6):
  for col in range(-5,6):
   x=col*2.85+(row%2)*1.425;zz=row*2.5;rr=(x*x+zz*zz)/18.7**2
   if rr>.76:continue
   y=-23-2.7*math.sqrt(1-rr)
   bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,location=(x,y-.12,z+zz))
   o=bpy.context.object;o.scale=(.66,.18,.66);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'Optica_'+name+'_'+str(row)+'_'+str(col),m,smooth=False)
 hood('Visera_'+name,z)

# Save and export the model only, with millimetre coordinates for OBJ/STL.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.wm.obj_export(filepath=str(ROOT/'modelos/semaforo.obj'),export_selected_objects=True,forward_axis='NEGATIVE_Y',up_axis='Z',export_materials=True,apply_modifiers=True)
bpy.ops.wm.stl_export(filepath=str(ROOT/'modelos/semaforo.stl'),export_selected_objects=True,apply_modifiers=True,forward_axis='Y',up_axis='Z')
# GLB uses metres per glTF convention. Apply scene units explicitly via temporary scale.
for o in parts:o.scale*=.001;o.location*=.001
bpy.context.scene.unit_settings.scale_length=1
bpy.ops.export_scene.gltf(filepath=str(ROOT/'modelos/semaforo.glb'),export_format='GLB',use_selection=True,export_yup=True)
for o in parts:o.scale*=1000;o.location*=1000
bpy.context.scene.unit_settings.scale_length=.001
bpy.context.view_layer.update()

# Build compact grouped world-space triangle arrays for the fully embedded HTML viewer.
group={}
for o in parts:
 mesh=o.data;mesh.calc_loop_triangles(); m=o.data.materials[0];key=m.name
 if key not in group:group[key]={'name':key,'color':list(m.diffuse_color[:3]),'metal':float(m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value),'rough':float(m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value),'pos':[],'norm':[]}
 g=group[key];normalmat=o.matrix_world.to_3x3().inverted().transposed()
 for tri in mesh.loop_triangles:
  for vi in tri.vertices:
   v=o.matrix_world@mesh.vertices[vi].co;n=(normalmat@mesh.vertices[vi].normal).normalized()
   # Blender Z up -> Three Y up, front negative Y -> Three +Z.
   g['pos'].extend([round(v.x,5),round(v.z,5),round(-v.y,5)])
   g['norm'].extend([round(n.x,5),round(n.z,5),round(-n.y,5)])
(ROOT/'fuentes/mallas.json').write_text(json.dumps(list(group.values()),separators=(',',':')))

# Reusable native file, camera and lights for a reference render.
floor=mat('Suelo',(.78,.8,.82),0,.7)
cube('Suelo_render',(0,0,-3),(20000,20000,5),floor,0)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(460,-730,400));cam=bpy.context.object;aim(cam,(0,0,152));cam.data.type='ORTHO';cam.data.ortho_scale=380;bpy.context.scene.camera=cam
for loc,power,size in [((0,-380,550),4200000,350),((300,150,420),3000000,300),((-280,-40,280),2000000,250)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,160))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=96
scene.cycles.use_denoising=False
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.8,.8,.8,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.6;scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'Vista_previa.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'modelos/semaforo.blend'))
bpy.ops.render.render(write_still=True)
print('MODEL_COMPLETE',len(parts),'objects')
