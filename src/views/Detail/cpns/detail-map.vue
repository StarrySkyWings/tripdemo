<template>
  <div class="map">
    <detailSection title="位置周边" more-text="查看更多周边信息">
      <div class="baidu" ref="mapRef">
        <p v-if="loadFailed" class="map-tip">地图加载失败，请检查网络</p>
      </div>
    </detailSection>
  </div>
</template>

<script setup>
import detailSection from '@/components/detail-section/detail-section.vue';
import { onMounted, ref } from 'vue';
import { loadBaiduMap } from '@/utils/bmap';

const props = defineProps({
  position: {
    type: Object,
    default: () => ({})
  }
})
const mapRef = ref()
const loadFailed = ref(false)

onMounted(async () => {
  // SDK 按需加载，首屏不再被它阻塞
  try {
    await loadBaiduMap()
  } catch (err) {
    console.warn('[map]', err.message)
    loadFailed.value = true
    return
  }

  const BMap = window.BMap
  const map = new BMap.Map(mapRef.value); // 创建地图实例
  const point = new BMap.Point(props.position.longitude, props.position.latitude); // 创建点坐标
  map.centerAndZoom(point, 15); // 初始化地图，设置中心点坐标和地图级别
  const marker = new BMap.Marker(point); // 创建标注    
  map.addOverlay(marker); // 将标注添加到地图中 

  const geolocationControl = new BMap.GeolocationControl({
    anchor: BMAP_ANCHOR_BOTTOM_RIGHT,
    offset: new BMap.Size(20, 100),
    onLocationStart: () => {
      map.panTo(point, {
        duration: 1000
      })
      return false
    },
    showAddressBar: false,
    enableAutoLocation: false,
  });
  map.addControl(geolocationControl);
  map.addControl(new BMap.ZoomControl({
    anchor: BMAP_ANCHOR_BOTTOM_RIGHT,
    offset: new BMap.Size(20, 20)
  }));
})
</script>

<style lang="less" scoped>
.baidu {
  height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;

  .map-tip {
    font-size: 13px;
    color: #999;
  }
}
</style>