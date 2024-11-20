from rest_framework import serializers
from .models import Profile, Achievement
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password


Profile = get_user_model()  # This gets your custom user model

class AchievementsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = '__all__'

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("New passwords do not match")
        return data

    def validate_new_password(self, value):
        validate_password(value)  # Apply Django's password validators
        return value

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'image']  # Include the image field


class ProfileSerializer(serializers.ModelSerializer):
    achievements = AchievementsSerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = ['first_name', 'last_name', 'email', 'username', 'image', 'achievements', 'wins', 'losses', 'level']  # Include the image field


class RegistrationSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(style={'input_type': 'password'}, write_only=True)

    class Meta:
        model = Profile
        fields = ['username', 'email', 'password', 'password2']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def save(self):
        user = Profile(
            username=self.validated_data['username'],
            email=self.validated_data['email']
        )
        password = self.validated_data['password']
        password2 = self.validated_data['password2']

        if password != password2:
            raise serializers.ValidationError({'password': 'Passwords must match.'})

        user.set_password(password)
        user.save()
        return user

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)  # Get the token data
        user = self.user  # Get the user
        
        # Add user-specific information
        data['id'] = user.id
        data['username'] = user.username
        data['email'] = user.email
        data['first_name'] = user.first_name
        data['last_name'] = user.last_name
        data['profile_image'] = user.image.url  # If you want to include the profile image

        return data
