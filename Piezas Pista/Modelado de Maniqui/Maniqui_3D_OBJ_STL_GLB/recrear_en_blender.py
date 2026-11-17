import bpy, math, os, json, bmesh
from mathutils import Vector
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'Maniqui_3D')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=.65
 return m
gray=mat('Polimero_gris_neutro',(.57,.60,.65)); orange=mat('Polo_naranja',(.95,.24,.025)); navy=mat('Pantalon_azul_marino',(.025,.044,.11)); white=mat('Tenis_blancos',(.86,.88,.91)); sole=mat('Suela_grafito',(.055,.065,.085)); seam=mat('Detalle_naranja',(.73,.145,.018))
parts=[]
def finish(o,name,m):
 o.name=name; o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 parts.append(o); return o
def ell(name,loc,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc);o=bpy.context.object;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,m)
def loft(name,rings,m,n=32,sub=1):
 # Each ring: center x,y,z and elliptical radii x,y.
 vs=[];fs=[]
 for x,y,z,rx,ry in rings:
  for i in range(n):
   t=2*math.pi*i/n;vs.append((x+rx*math.cos(t),y+ry*math.sin(t),z))
 for j in range(len(rings)-1):
  for i in range(n):
   a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs.append(tuple(reversed(range(n))));fs.append(tuple((len(rings)-1)*n+i for i in range(n)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 finish(o,name,m)
 if sub:
  mod=o.modifiers.new('Superficie_suave','SUBSURF');mod.levels=sub
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def limb(name,a,b,profile,m):
 a,b=Vector(a),Vector(b);d=b-a
 o=loft(name,[(0,0,t*d.length,rx,ry) for t,rx,ry in profile],m)
 o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');o.location=a
 return o
loft('Polo_torso',[(0,0,.88,.145,.092),(0,0,.90,.16,.105),(0,0,.94,.16,.105),(0,0,1.04,.15,.101),(0,0,1.18,.18,.113),(0,0,1.29,.218,.115),(0,0,1.34,.21,.105),(0,0,1.38,.145,.082),(0,0,1.405,.065,.062)],orange)
ell('Cadera_pantalon',(0,0,.87),(.157,.099,.135),navy)
limb('Cuello',(0,0,1.36),(0,0,1.49),[(0,.055,.049),(.2,.058,.052),(.8,.051,.046),(1,.045,.043)],gray)
loft('Cabeza_sin_rostro',[(0,-.012,1.45,.015,.022),(0,-.014,1.47,.048,.052),(0,-.006,1.51,.071,.072),(0,0,1.58,.088,.083),(0,.003,1.65,.092,.081),(0,.006,1.70,.075,.064),(0,.006,1.735,.044,.041),(0,.006,1.747,.006,.008)],gray,sub=2)
for s,label in [(-1,'izq'),(1,'der')]:
 hip=(s*.087,0,.91);knee=(s*.10, -.035 if s==1 else .018,.49);ankle=(s*.115,-.06 if s==1 else .025,.13)
 limb('Pantalon_muslo_'+label,hip,knee,[(0,.083,.085),(.12,.088,.09),(.4,.077,.08),(.8,.059,.065),(1,.059,.061)],navy)
 limb('Pantalon_pierna_'+label,knee,ankle,[(0,.06,.063),(.15,.062,.066),(.5,.057,.062),(.92,.047,.052),(1,.047,.052)],navy)
 ell('Rodilla_'+label,knee,(.059,.061,.065),navy)
 x,y,z=ankle
 loft('Suela_'+label,[(x,y-.035,.018,.062,.119),(x,y-.035,.02,.068,.127),(x,y-.035,.055,.069,.127),(x,y-.035,.063,.064,.12)],sole)
 loft('Tenis_'+label,[(x,y-.035,.052,.063,.117),(x,y-.038,.065,.066,.12),(x,y-.031,.095,.061,.111),(x,y-.012,.133,.05,.073),(x,y+.008,.15,.044,.047)],white)
 for i in range(4):
  yy=y-.08+i*.018
  limb('Agujeta_'+label+str(i),(x-.025,yy,.125-i*.002),(x+.025,yy,.125-i*.002),[(0,.003,.003),(.1,.003,.003),(.9,.003,.003),(1,.003,.003)],white)
 shoulder=(s*.19,0,1.305);sleeve=(s*.249,-.005,1.19);elbow=(s*.286,-.012,1.04);wrist=(s*.31,-.047,.855)
 limb('Manga_'+label,shoulder,sleeve,[(0,.078,.083),(.18,.079,.084),(.72,.068,.072),(.95,.063,.065),(1,.063,.065)],orange)
 limb('Brazo_'+label,sleeve,elbow,[(0,.052,.054),(.2,.055,.056),(.6,.048,.049),(1,.04,.041)],gray)
 ell('Codo_'+label,elbow,(.041,.041,.045),gray)
 limb('Antebrazo_'+label,elbow,wrist,[(0,.039,.04),(.2,.047,.046),(.55,.039,.039),(.95,.027,.03),(1,.027,.03)],gray)
 palm=(s*.313,-.05,.805)
 ell('Mano_'+label,palm,(.035,.022,.06),gray)
 for i in range(4):
  xx=s*(.29+i*.015);zt=.775
  limb('Dedo_'+label+str(i),(xx,-.052,zt),(xx,-.062,zt-.027-(.008 if i in (1,2) else 0)),[(0,.008,.009),(.2,.009,.009),(.85,.007,.007),(1,.003,.003)],gray)
 limb('Pulgar_'+label,(s*.287,-.055,.825),(s*.266,-.075,.787),[(0,.013,.014),(.4,.013,.014),(.85,.01,.01),(1,.004,.005)],gray)
# Polo collar, two flattened triangular flaps.
for s,label in [(-1,'izq'),(1,'der')]:
 verts=[(s*.015,-.071,1.402),(s*.064,-.058,1.397),(s*.104,-.092,1.365),(s*.055,-.119,1.329)]
 me=bpy.data.meshes.new('Cuello_polo');me.from_pydata(verts,[],[(0,1,2,3)]);me.update();o=bpy.data.objects.new('Solapa_'+label,me);bpy.context.collection.objects.link(o);finish(o,orange.name and 'Solapa_'+label,orange)
 sol=o.modifiers.new('Grosor','SOLIDIFY');sol.thickness=.007
 bev=o.modifiers.new('Bordes','BEVEL');bev.width=.007;bev.segments=3
 bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
for i in range(3):ell('Boton_'+str(i),(0,-.113,1.333-i*.026),(.006,.004,.006),seam)
# Export only modeled objects, never camera, lighting or background.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.wm.obj_export(filepath=OUT+'/maniqui.obj',export_selected_objects=True,forward_axis='NEGATIVE_Y',up_axis='Z',export_materials=True,export_triangulated_mesh=True)
bpy.ops.export_scene.gltf(filepath=OUT+'/maniqui.glb',export_format='GLB',use_selection=True)
# Native edit source with individually named meshes.
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.85,1,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.9,-5.2,3.0));camera=bpy.context.object;camera.name='Camara_preview';aim(camera,(0,0,.88));camera.data.type='ORTHO';camera.data.ortho_scale=2.05;scene.camera=camera
for name,loc,power,size in [('Luz_principal',(-3,-4,5),450,4),('Luz_relleno',(4,-1,3),250,3),('Luz_borde',(0,3,4),400,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1))
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/maniqui.blend')
scene.render.filepath=OUT+'/vista_previa.png';bpy.ops.render.render(write_still=True)
# STL: fuse overlaps into one closed surface, scaled to ~180 mm.
bpy.ops.object.select_all(action='DESELECT')
copies=[]
for o in parts:
 c=o.copy();c.data=o.data.copy();bpy.context.collection.objects.link(c);c.select_set(True);copies.append(c)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();solid=bpy.context.object;solid.name='Maniqui_STL_unificado'
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
mod=solid.modifiers.new('Union_volumetrica','REMESH');mod.mode='VOXEL';mod.voxel_size=.0035;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=solid.modifiers.new('Suavizado','SMOOTH');mod.factor=.5;mod.iterations=3;bpy.ops.object.modifier_apply(modifier=mod.name)
bm=bmesh.new();bm.from_mesh(solid.data);nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
height=solid.dimensions.z;factor=180/height;solid.scale=(factor,)*3
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.ops.wm.stl_export(filepath=OUT+'/maniqui_180mm.stl',export_selected_objects=True)
report={'objetos_OBJ_GLB':len(parts),'triangulos_visual_aprox':sum(len(o.data.polygons) for o in parts)*2,'STL_aristas_no_manifold':nonmanifold,'STL_altura_mm':round(solid.dimensions.z,3)}
open(OUT+'/verificacion.json','w').write(json.dumps(report,indent=2));print('RESULTADO',report)
