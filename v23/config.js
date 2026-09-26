window.JT_CONFIG={APP_VERSION:'V25-CLEAN',APP_NAME:'J&T e iMile'};
(function(){
  var target='./app-clean.html?v=20260925';
  if(location.pathname.indexOf('/v23/')!==-1 && !location.pathname.endsWith('/app-clean.html')){
    location.replace(target);
  }
})();