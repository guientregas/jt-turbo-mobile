window.JT_CONFIG={APP_VERSION:'V26-STABLE',APP_NAME:'J&T e iMile'};
(function(){
  var target='./app-final.html?v=20260926-v26';
  if(location.pathname.indexOf('/v23/')!==-1 && !location.pathname.endsWith('/app-final.html')){
    location.replace(target);
  }
})();
