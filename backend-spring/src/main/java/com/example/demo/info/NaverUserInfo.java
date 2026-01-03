package com.example.demo.info;

import java.util.Map;

import com.example.demo.social.OAuth2UserInfo;

public class NaverUserInfo implements OAuth2UserInfo {
    private final Map<String, Object> attributes;

    public NaverUserInfo(Map<String, Object> response) {
        this.attributes = response;
    }

    @Override public String getProvider() { return "naver"; }
    @Override public String getProviderKey() { return (String) attributes.get("id"); }
    @Override public String getEmail() { return (String) attributes.get("email"); }
    @Override public String getName() { return (String) attributes.get("name"); }
}


