package utils

import "testing"

func TestGenerateBase64URLSafeSHA256ID(t *testing.T) {
	type args struct {
		text string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "空字符串",
			args: args{
				text: "",
			},
			want: "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
		},
		{
			name: "简单字符串",
			args: args{
				text: "hello",
			},
			want: "LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ",
		},
		{
			name: "中文字符",
			args: args{
				text: "你好世界",
			},
			want: "vspjNbIP9XzMR0A-9NnguPzLREKzFRwufVAFBnPUMXI",
		},
		{
			name: "特殊字符",
			args: args{
				text: "!@#$%^&*()_+",
			},
			want: "NtPhvGX4tnk1rmD1QqvvPlXFu71UeFSWZADMTwIlZss",
		},
		{
			name: "长字符串",
			args: args{
				text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
			},
			want: "lzFT-G7C2hdI5j8M-FuJg1tC-O6AGMVJhooTCKGfbKM",
		},
		{
			name: "JSON字符串",
			args: args{
				text: `{"name":"test","value":123}`,
			},
			want: "0uhytGrvKriwKoVItv50ajPTPL4UQsoGA-z-ZFiC-y0",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := GenerateBase64URLSafeSHA256ID(tt.args.text); got != tt.want {
				t.Errorf("GenerateBase64URLSafeSHA256ID() = %v, want %v", got, tt.want)
			}
		})
	}
}
