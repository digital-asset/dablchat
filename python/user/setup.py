from setuptools import setup

setup(name='dablchat-user-bot',
      version='1.8.4',
      description='DABL Chat User',
      author='Digital Asset',
      license='Apache2',
      install_requires=['dazl>=7,<8', 'aiohttp'],
      packages=['bot'],
      include_package_data=True)
