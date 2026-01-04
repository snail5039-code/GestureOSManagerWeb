package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TranslateResponse {

  // ✅ label / word_id / wordId / id 전부 허용
  @JsonProperty("label")
  @JsonAlias({"word_id", "wordId", "id"})
  private String label;

  private String text;
  private double confidence;

  // ✅ frames_received or framesReceived
  @JsonProperty("frames_received")
  @JsonAlias({"framesReceived"})
  private Integer framesReceived;

  private String mode;
  private Integer streak;

  private KcisaItem kcisa;
}