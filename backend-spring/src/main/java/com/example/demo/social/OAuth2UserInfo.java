package com.example.demo.social;

public interface OAuth2UserInfo {
    String getProvider();    // google/kakao/naver
    String getProviderKey(); // provider unique id
    String getEmail();       // 없을 수 있음
    String getName();        // 없을 수 있음
}



