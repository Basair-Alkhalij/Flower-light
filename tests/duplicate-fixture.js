// Same fixture is exercised in Node VM and Chromium; no live backend writes.
window.setupDuplicateFixture = function(failGallery=false) {
  const state={copies:[],removed:[],deleted:[],messages:[],opened:[],rpc:[],payload:null};
  const source={id:'p1',category_id:'c1',name:'مصباح',model:'M1',image_path:'c1/old.l.webp',price:100,wholesale_price:80,wholesale_min_qty:10,limited_offer:true,specifications:[{key:'power',value:'20W'}]};
  const core={products:[source],productImages:[],categories:[{id:'c1',name:'إنارة'}],siteCatalogs:[],selectedCategory:'c1',selectedProductNode:'category:c1',bucket:'product-images',MAX_PRODUCT_IMAGES:4,
    esc:v=>String(v??''),notify:m=>state.messages.push(m),layout(){},body:{querySelector(){return null;},querySelectorAll(){return[];}},imageUrl:p=>p,isStoragePath:p=>!p.startsWith('https:'),
    normalizeSpecifications:s=>s,productPricingTiers:()=>[{type:'retail',price:100}],PRICE_TIER_TYPE_MAP:new Map(),
    WHATSAPP_META_SHOW_DESCRIPTION:'show_description',WHATSAPP_META_SHOW_SPECS:'show_specs',productWhatsAppOption:(_s,key)=>key==='show_specs',pricingMetaRow:tiers=>({key:'pricing',value:JSON.stringify(tiers)}),
    syncPublicProductsFromAdminCache(){},loadCatalogAdminData:async()=>{core.products.push({...state.payload,id:'p2'});},catalogAdminCard(){},openCatalogForm(){},deleteCatalog(){},
    db:{from(){return {insert(payload){state.payload=payload;return {select(){return {single:async()=>({data:{id:'p2'},error:null})};}};},delete(){return {eq:async(_key,id)=>{state.deleted.push(id);return {error:null};}};}};},rpc:async(name,args)=>{state.rpc.push({name,args});return {error:failGallery&&name==='set_product_gallery_for_admin'?new Error('gallery failed'):null};},storage:{from(){return {copy:async(a,b)=>{state.copies.push([a,b]);return {error:null};},remove:async paths=>{state.removed.push(...paths);return {error:null};}};}}}
  };
  window.FL_ADMIN_CORE=core;window.FL_ADMIN_PRODUCT_FORM={openProductForm:p=>state.opened.push(p.id)};
  window.__duplicateState=state;return state;
};
